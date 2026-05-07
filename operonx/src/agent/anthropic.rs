//! Anthropic Messages streaming client.
//!
//! Anthropic's `/v1/messages` API differs from OpenAI in several ways:
//!   - Request: `{model, max_tokens, system, messages, tools, stream}`
//!     where `messages` must not contain the system prompt.
//!   - Tool schema: `{name, description, input_schema}` not `{type,function{...}}`.
//!   - SSE events: `message_start`, `content_block_start`, `content_block_delta`,
//!     `content_block_stop`, `message_delta`, `message_stop`.
//!   - Tool arguments arrive as a JSON delta string in `input_json_delta`.
//!
//! We map Anthropic SSE events into the same `OpenAiEvent` enum the runner
//! already understands, so the runner loop needs zero changes.

use std::collections::HashMap;

use anyhow::{Context, Result, anyhow};
use bytes::Bytes;
use futures::{Stream, StreamExt};
use reqwest::Client;
use serde_json::{Value, json};

use super::openai::{ChatMessage, OpenAiEvent, ToolCall, ToolCallFunction};

/// Convert OpenAI-style `ChatMessage` list → Anthropic messages array.
/// Anthropic does not accept a system role in the messages array; the caller
/// must extract that separately (we skip it here and pass it via the `system`
/// field in the request body).
fn to_anthropic_messages(messages: &[ChatMessage]) -> Value {
    let mut out = Vec::new();
    for msg in messages {
        match msg.role.as_str() {
            "system" => continue, // handled separately
            "tool" => {
                // OpenAI "tool" role → Anthropic "user" role with tool_result content
                out.push(json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": msg.tool_call_id,
                        "content": msg.content.as_deref().unwrap_or(""),
                    }]
                }));
            }
            "assistant" => {
                let mut content: Vec<Value> = Vec::new();
                if let Some(text) = msg.content.as_deref().filter(|t| !t.is_empty()) {
                    content.push(json!({ "type": "text", "text": text }));
                }
                if let Some(tcs) = &msg.tool_calls {
                    for tc in tcs {
                        let input: Value = serde_json::from_str(&tc.function.arguments)
                            .unwrap_or(json!({}));
                        content.push(json!({
                            "type": "tool_use",
                            "id": tc.id,
                            "name": tc.function.name,
                            "input": input,
                        }));
                    }
                }
                if !content.is_empty() {
                    out.push(json!({ "role": "assistant", "content": content }));
                }
            }
            _ => {
                // user
                out.push(json!({
                    "role": "user",
                    "content": msg.content.as_deref().unwrap_or(""),
                }));
            }
        }
    }
    json!(out)
}

/// Convert OpenAI tool definitions `{type:"function", function:{name, description, parameters}}`
/// → Anthropic `{name, description, input_schema}`.
fn to_anthropic_tools(tools: &[Value]) -> Value {
    let converted: Vec<Value> = tools
        .iter()
        .filter_map(|t| {
            let f = t.get("function")?;
            Some(json!({
                "name": f.get("name")?,
                "description": f.get("description").and_then(|v| v.as_str()).unwrap_or(""),
                "input_schema": f.get("parameters").cloned().unwrap_or(json!({"type":"object","properties":{}})),
            }))
        })
        .collect();
    json!(converted)
}

pub async fn stream_chat(
    client: &Client,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    tools: &[Value],
) -> Result<impl Stream<Item = Result<OpenAiEvent>> + use<>> {
    let system_text = messages
        .iter()
        .find(|m| m.role == "system")
        .and_then(|m| m.content.as_deref())
        .unwrap_or("");

    let anthropic_messages = to_anthropic_messages(messages);

    let mut body = json!({
        "model": model,
        "max_tokens": 8192,
        "stream": true,
        "system": system_text,
        "messages": anthropic_messages,
    });
    if !tools.is_empty() {
        body["tools"] = to_anthropic_tools(tools);
        body["tool_choice"] = json!({ "type": "auto" });
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("sending Anthropic request")?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!("anthropic error {status}: {text}"));
    }

    Ok(parse_anthropic_sse(response.bytes_stream()))
}

fn parse_anthropic_sse(
    upstream: impl Stream<Item = reqwest::Result<Bytes>> + Send + 'static + Unpin,
) -> impl Stream<Item = Result<OpenAiEvent>> {
    async_stream::try_stream! {
        let mut upstream = upstream;
        let mut buffer = String::new();

        // Track active tool use blocks: index → (id, name, accumulated_input_json)
        let mut tool_blocks: HashMap<usize, (String, String, String)> = HashMap::new();
        // Map content block index → type ("text" or "tool_use")
        let mut block_types: HashMap<usize, String> = HashMap::new();
        let mut current_block_index: usize = 0;

        while let Some(chunk) = upstream.next().await {
            let chunk = chunk.context("reading Anthropic stream")?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            loop {
                let Some(idx) = buffer.find("\n\n") else { break };
                let event_block = buffer[..idx].to_owned();
                buffer.drain(..idx + 2);

                let mut event_type = String::new();
                let mut data_line = String::new();

                for line in event_block.lines() {
                    if let Some(t) = line.strip_prefix("event:") {
                        event_type = t.trim().to_owned();
                    } else if let Some(d) = line.strip_prefix("data:") {
                        data_line = d.trim().to_owned();
                    }
                }

                if data_line.is_empty() {
                    continue;
                }

                let data: Value = match serde_json::from_str(&data_line) {
                    Ok(v) => v,
                    Err(_) => continue,
                };

                match event_type.as_str() {
                    "content_block_start" => {
                        let index = data.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                        current_block_index = index;
                        let block = &data["content_block"];
                        let kind = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        block_types.insert(index, kind.to_owned());

                        if kind == "tool_use" {
                            let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_owned();
                            let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("").to_owned();
                            tool_blocks.insert(index, (id.clone(), name.clone(), String::new()));
                            yield OpenAiEvent::ToolCallBegin { index, id, name };
                        }
                    }

                    "content_block_delta" => {
                        let index = data.get("index").and_then(|v| v.as_u64()).unwrap_or(current_block_index as u64) as usize;
                        let delta = &data["delta"];
                        let delta_type = delta.get("type").and_then(|v| v.as_str()).unwrap_or("");

                        if delta_type == "text_delta" {
                            if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                                if !text.is_empty() {
                                    yield OpenAiEvent::TextDelta(text.to_owned());
                                }
                            }
                        } else if delta_type == "input_json_delta" {
                            if let Some(partial) = delta.get("partial_json").and_then(|v| v.as_str()) {
                                if let Some(entry) = tool_blocks.get_mut(&index) {
                                    entry.2.push_str(partial);
                                }
                            }
                        }
                    }

                    "message_stop" | "message_delta" => {
                        // Collect finished tool calls
                        let mut tool_calls: Vec<ToolCall> = Vec::new();
                        let mut indices: Vec<usize> = tool_blocks.keys().copied().collect();
                        indices.sort();
                        for idx in indices {
                            if let Some((id, name, args)) = tool_blocks.remove(&idx) {
                                tool_calls.push(ToolCall {
                                    id,
                                    kind: "function".to_owned(),
                                    function: ToolCallFunction {
                                        name,
                                        arguments: if args.is_empty() { "{}".to_owned() } else { args },
                                    },
                                });
                            }
                        }
                        let finish_reason = if tool_calls.is_empty() { "stop" } else { "tool_calls" };
                        if event_type == "message_stop" {
                            yield OpenAiEvent::Finished {
                                finish_reason: finish_reason.to_owned(),
                                tool_calls,
                            };
                            return;
                        }
                    }

                    _ => {}
                }
            }
        }
    }
}
