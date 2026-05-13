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

use std::{collections::HashMap, time::Duration};

use anyhow::{Context, Result, anyhow};
use bytes::Bytes;
use futures::{Stream, StreamExt};
use reqwest::{Client, Response};
use serde_json::{Value, json};

use super::openai::{ChatMessage, OpenAiEvent, ToolCall, ToolCallFunction};

#[derive(Debug, Clone)]
struct AnthropicRetryInfo {
    attempt: usize,
    max_attempts: usize,
    delay_ms: u64,
    message: String,
}

fn to_anthropic_messages(messages: &[ChatMessage]) -> Value {
    let mut out = Vec::new();
    for msg in messages {
        match msg.role.as_str() {
            "system" => continue,
            "tool" => {
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
                if let Some(text) = msg.content.as_deref().filter(|text| !text.is_empty()) {
                    content.push(json!({ "type": "text", "text": text }));
                }
                if let Some(tool_calls) = &msg.tool_calls {
                    for tool_call in tool_calls {
                        let input: Value = serde_json::from_str(&tool_call.function.arguments)
                            .unwrap_or(json!({}));
                        content.push(json!({
                            "type": "tool_use",
                            "id": tool_call.id,
                            "name": tool_call.function.name,
                            "input": input,
                        }));
                    }
                }
                if !content.is_empty() {
                    out.push(json!({ "role": "assistant", "content": content }));
                }
            }
            _ => {
                out.push(json!({
                    "role": "user",
                    "content": msg.content.as_deref().unwrap_or(""),
                }));
            }
        }
    }
    json!(out)
}

fn to_anthropic_tools(tools: &[Value]) -> Value {
    let converted: Vec<Value> = tools
        .iter()
        .filter_map(|tool| {
            let function = tool.get("function")?;
            Some(json!({
                "name": function.get("name")?,
                "description": function.get("description").and_then(Value::as_str).unwrap_or(""),
                "input_schema": function.get("parameters").cloned().unwrap_or(json!({ "type": "object", "properties": {} })),
            }))
        })
        .collect();
    json!(converted)
}

/// Map UI-level reasoning hint to Anthropic `thinking.budget_tokens`.
/// Returns `None` to omit the field on non-thinking models.
fn anthropic_thinking_budget(level: Option<&str>) -> Option<u32> {
    match level.map(str::to_ascii_lowercase).as_deref() {
        Some("low") => Some(1024),
        Some("medium") | Some("auto") => Some(4096),
        Some("high") => Some(16384),
        _ => None,
    }
}

pub async fn stream_chat(
    client: &Client,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    tools: &[Value],
    reasoning_level: Option<&str>,
) -> Result<impl Stream<Item = Result<OpenAiEvent>> + use<>> {
    let system_text = messages
        .iter()
        .find(|message| message.role == "system")
        .and_then(|message| message.content.as_deref())
        .unwrap_or("");

    let mut body = json!({
        "model": model,
        "max_tokens": 8192,
        "stream": true,
        "system": system_text,
        "messages": to_anthropic_messages(messages),
    });
    if !tools.is_empty() {
        body["tools"] = to_anthropic_tools(tools);
        body["tool_choice"] = json!({ "type": "auto" });
    }
    if let Some(budget) = anthropic_thinking_budget(reasoning_level) {
        body["thinking"] = json!({ "type": "enabled", "budget_tokens": budget });
    }

    let (response, retries) = send_anthropic_stream_request(client, api_key, &body).await?;

    let request_id = response
        .headers()
        .get("request-id")
        .or_else(|| response.headers().get("x-request-id"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let byte_stream = response.bytes_stream();

    let prefix: Vec<Result<OpenAiEvent>> = retries
        .into_iter()
        .map(|retry| {
            Ok(OpenAiEvent::ProviderRetry {
                attempt: retry.attempt,
                max_attempts: retry.max_attempts,
                delay_ms: retry.delay_ms,
                message: retry.message,
            })
        })
        .chain(request_id.map(|id| Ok(OpenAiEvent::ProviderRequestId(id))))
        .collect();

    Ok(futures::stream::iter(prefix).chain(parse_anthropic_sse(byte_stream)))
}

async fn send_anthropic_stream_request(
    client: &Client,
    api_key: &str,
    body: &Value,
) -> Result<(Response, Vec<AnthropicRetryInfo>)> {
    const MAX_ATTEMPTS: usize = 4;
    let mut retries = Vec::new();

    for attempt in 1..=MAX_ATTEMPTS {
        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(body)
            .send()
            .await
            .context("sending Anthropic request")?;

        let status = response.status();
        if status.is_success() {
            return Ok((response, retries));
        }

        let retry_after = retry_after_delay(&response);
        let text = response.text().await.unwrap_or_default();
        if status.as_u16() == 429 && attempt < MAX_ATTEMPTS {
            let delay = retry_after.unwrap_or_else(|| Duration::from_millis(750 * attempt as u64));
            tracing::warn!(
                attempt,
                max_attempts = MAX_ATTEMPTS,
                retry_after_ms = delay.as_millis() as u64,
                "anthropic rate limited; retrying"
            );
            retries.push(AnthropicRetryInfo {
                attempt,
                max_attempts: MAX_ATTEMPTS,
                delay_ms: delay.as_millis() as u64,
                message: "anthropic was rate limited; retried request".to_owned(),
            });
            tokio::time::sleep(delay).await;
            continue;
        }

        return Err(anyhow!("anthropic error {status}: {text}"));
    }

    Err(anyhow!("anthropic error: exhausted retry attempts"))
}

fn retry_after_delay(response: &Response) -> Option<Duration> {
    let value = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?;
    let seconds = value.parse::<f64>().ok()?;
    Some(Duration::from_secs_f64(seconds.max(0.0)))
}

fn parse_anthropic_sse(
    upstream: impl Stream<Item = reqwest::Result<Bytes>> + Send + 'static + Unpin,
) -> impl Stream<Item = Result<OpenAiEvent>> {
    async_stream::try_stream! {
        let mut upstream = upstream;
        let mut buffer = String::new();
        let mut tool_blocks: HashMap<usize, (String, String, String)> = HashMap::new();
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
                    if let Some(kind) = line.strip_prefix("event:") {
                        event_type = kind.trim().to_owned();
                    } else if let Some(data) = line.strip_prefix("data:") {
                        data_line = data.trim().to_owned();
                    }
                }

                if data_line.is_empty() {
                    continue;
                }

                let data: Value = match serde_json::from_str(&data_line) {
                    Ok(value) => value,
                    Err(_) => continue,
                };

                match event_type.as_str() {
                    "message_start" => {
                        if let Some((input_tokens, output_tokens)) = usage_tokens(data.get("message").and_then(|message| message.get("usage"))) {
                            yield OpenAiEvent::Usage {
                                prompt_tokens: input_tokens,
                                completion_tokens: output_tokens,
                                total_tokens: input_tokens + output_tokens,
                            };
                        }
                    }
                    "content_block_start" => {
                        let index = data.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
                        current_block_index = index;
                        let block = &data["content_block"];
                        let kind = block.get("type").and_then(Value::as_str).unwrap_or("");

                        if kind == "tool_use" {
                            let id = block.get("id").and_then(Value::as_str).unwrap_or("").to_owned();
                            let name = block.get("name").and_then(Value::as_str).unwrap_or("").to_owned();
                            tool_blocks.insert(index, (id.clone(), name.clone(), String::new()));
                            yield OpenAiEvent::ToolCallBegin { index, id, name };
                        }
                    }
                    "content_block_delta" => {
                        let index = data
                            .get("index")
                            .and_then(Value::as_u64)
                            .unwrap_or(current_block_index as u64) as usize;
                        let delta = &data["delta"];
                        let delta_type = delta.get("type").and_then(Value::as_str).unwrap_or("");

                        if delta_type == "text_delta" {
                            if let Some(text) = delta.get("text").and_then(Value::as_str).filter(|text| !text.is_empty()) {
                                yield OpenAiEvent::TextDelta(text.to_owned());
                            }
                        } else if delta_type == "thinking_delta" {
                            if let Some(text) = delta.get("thinking").and_then(Value::as_str).filter(|text| !text.is_empty()) {
                                yield OpenAiEvent::ReasoningDelta(text.to_owned());
                            }
                        } else if delta_type == "input_json_delta" {
                            if let Some(partial) = delta.get("partial_json").and_then(Value::as_str) {
                                if let Some(entry) = tool_blocks.get_mut(&index) {
                                    entry.2.push_str(partial);
                                    if !entry.0.is_empty() && !entry.1.is_empty() && !entry.2.is_empty() {
                                        yield OpenAiEvent::ToolCallInputDelta {
                                            id: entry.0.clone(),
                                            arguments: entry.2.clone(),
                                        };
                                    }
                                }
                            }
                        }
                    }
                    "message_delta" => {
                        if let Some((input_tokens, output_tokens)) = usage_tokens(data.get("usage")) {
                            yield OpenAiEvent::Usage {
                                prompt_tokens: input_tokens,
                                completion_tokens: output_tokens,
                                total_tokens: input_tokens + output_tokens,
                            };
                        }
                    }
                    "message_stop" => {
                        let mut tool_calls: Vec<ToolCall> = Vec::new();
                        let mut indices: Vec<usize> = tool_blocks.keys().copied().collect();
                        indices.sort();
                        for index in indices {
                            if let Some((id, name, arguments)) = tool_blocks.remove(&index) {
                                tool_calls.push(ToolCall {
                                    id,
                                    kind: "function".to_owned(),
                                    function: ToolCallFunction {
                                        name,
                                        arguments: if arguments.is_empty() { "{}".to_owned() } else { arguments },
                                    },
                                });
                            }
                        }
                        let finish_reason = if tool_calls.is_empty() { "stop" } else { "tool_calls" };
                        yield OpenAiEvent::Finished {
                            finish_reason: finish_reason.to_owned(),
                            tool_calls,
                        };
                        return;
                    }
                    _ => {}
                }
            }
        }
    }
}

fn usage_tokens(usage: Option<&Value>) -> Option<(u64, u64)> {
    let usage = usage?;
    let input_tokens = usage
        .get("input_tokens")
        .or_else(|| usage.get("cache_creation_input_tokens"))
        .and_then(Value::as_u64)
        .unwrap_or(0);
    let output_tokens = usage
        .get("output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0);
    if input_tokens == 0 && output_tokens == 0 {
        None
    } else {
        Some((input_tokens, output_tokens))
    }
}
