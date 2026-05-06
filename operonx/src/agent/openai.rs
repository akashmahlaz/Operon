//! OpenAI Chat Completions streaming client with tool-call support.
//!
//! Yields a stream of `OpenAiEvent` items. The runner is responsible for
//! turning these into AI SDK UI Message Stream Protocol frames, accumulating
//! tool call arguments, executing tools, and looping.

use std::collections::HashMap;

use anyhow::{Context, Result, anyhow};
use bytes::Bytes;
use futures::{Stream, StreamExt};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone)]
pub enum OpenAiEvent {
    /// Streaming text delta from the assistant.
    TextDelta(String),
    /// A tool call has begun (we got an id + name).
    ToolCallBegin { index: usize, id: String, name: String },
    /// More argument JSON arriving for a tool call.
    ToolCallArgsDelta { index: usize, delta: String },
    /// Stream finished. The accumulated tool calls (if any) are returned so
    /// the runner can dispatch and loop.
    Finished {
        finish_reason: String,
        tool_calls: Vec<ToolCall>,
    },
}

pub async fn stream_chat(
    client: &Client,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    tools: &[Value],
) -> Result<impl Stream<Item = Result<OpenAiEvent>> + use<>> {
    let body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
    });

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("sending OpenAI request")?;

    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(anyhow!("openai error {status}: {text}"));
    }

    let byte_stream = response.bytes_stream();

    Ok(parse_sse(byte_stream))
}

fn parse_sse(
    upstream: impl Stream<Item = reqwest::Result<Bytes>> + Send + 'static + Unpin,
) -> impl Stream<Item = Result<OpenAiEvent>> {
    async_stream::try_stream! {
        let mut upstream = upstream;
        let mut buffer = String::new();
        let mut tool_call_indices: HashMap<usize, ToolCall> = HashMap::new();

        while let Some(chunk) = upstream.next().await {
            let chunk = chunk.context("reading OpenAI stream")?;
            buffer.push_str(&String::from_utf8_lossy(&chunk));

            loop {
                let Some(idx) = buffer.find("\n\n") else { break };
                let event = buffer[..idx].to_owned();
                buffer.drain(..idx + 2);

                for line in event.lines() {
                    let Some(payload) = line.strip_prefix("data:") else { continue };
                    let payload = payload.trim();
                    if payload.is_empty() {
                        continue;
                    }
                    if payload == "[DONE]" {
                        let mut tool_calls: Vec<(usize, ToolCall)> =
                            tool_call_indices.drain().collect();
                        tool_calls.sort_by_key(|(i, _)| *i);
                        let finish_reason = if tool_calls.is_empty() {
                            "stop".to_owned()
                        } else {
                            "tool_calls".to_owned()
                        };
                        yield OpenAiEvent::Finished {
                            finish_reason,
                            tool_calls: tool_calls.into_iter().map(|(_, c)| c).collect(),
                        };
                        return;
                    }

                    let json: Value = match serde_json::from_str(payload) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };

                    let Some(choice) = json
                        .get("choices")
                        .and_then(|c| c.get(0))
                    else {
                        continue;
                    };

                    let delta = choice.get("delta");

                    if let Some(text) = delta
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        if !text.is_empty() {
                            yield OpenAiEvent::TextDelta(text.to_owned());
                        }
                    }

                    if let Some(tcs) = delta
                        .and_then(|d| d.get("tool_calls"))
                        .and_then(|t| t.as_array())
                    {
                        for tc in tcs {
                            let index = tc
                                .get("index")
                                .and_then(|v| v.as_u64())
                                .unwrap_or(0) as usize;
                            let id_opt = tc.get("id").and_then(|v| v.as_str()).map(str::to_owned);
                            let name_opt = tc
                                .get("function")
                                .and_then(|f| f.get("name"))
                                .and_then(|v| v.as_str())
                                .map(str::to_owned);
                            let arg_delta = tc
                                .get("function")
                                .and_then(|f| f.get("arguments"))
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            let entry = tool_call_indices.entry(index).or_insert_with(|| ToolCall {
                                id: String::new(),
                                kind: "function".to_owned(),
                                function: ToolCallFunction {
                                    name: String::new(),
                                    arguments: String::new(),
                                },
                            });

                            if let Some(id) = id_opt.clone() {
                                if entry.id.is_empty() {
                                    entry.id = id.clone();
                                }
                            }
                            if let Some(name) = name_opt.clone() {
                                if entry.function.name.is_empty() {
                                    entry.function.name = name.clone();
                                }
                            }
                            entry.function.arguments.push_str(arg_delta);

                            if id_opt.is_some() || name_opt.is_some() {
                                yield OpenAiEvent::ToolCallBegin {
                                    index,
                                    id: entry.id.clone(),
                                    name: entry.function.name.clone(),
                                };
                            }
                            if !arg_delta.is_empty() {
                                yield OpenAiEvent::ToolCallArgsDelta {
                                    index,
                                    delta: arg_delta.to_owned(),
                                };
                            }
                        }
                    }

                    if let Some(reason) = choice
                        .get("finish_reason")
                        .and_then(|r| r.as_str())
                    {
                        let mut tool_calls: Vec<(usize, ToolCall)> =
                            tool_call_indices.drain().collect();
                        tool_calls.sort_by_key(|(i, _)| *i);
                        yield OpenAiEvent::Finished {
                            finish_reason: reason.to_owned(),
                            tool_calls: tool_calls.into_iter().map(|(_, c)| c).collect(),
                        };
                        return;
                    }
                }
            }
        }
    }
}
