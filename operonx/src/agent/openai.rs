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

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    /// Streaming reasoning/thinking chunk (e.g. DeepSeek-R1 `reasoning_content`,
    /// or text inside `<think>...</think>` tags from MiniMax / Qwen-thinking).
    ReasoningDelta(String),
    /// A tool call has begun (we got an id + name).
    ToolCallBegin { index: usize, id: String, name: String },
    /// Stream finished. The accumulated tool calls (if any) are returned so
    /// the runner can dispatch and loop.
    Finished {
        finish_reason: String,
        tool_calls: Vec<ToolCall>,
    },
}

/// State machine that splits a stream of text chunks into reasoning vs visible
/// segments based on `<think>...</think>` markers. Handles tag boundaries that
/// straddle SSE chunks.
#[derive(Default)]
pub struct ThinkSplitter {
    inside: bool,
    /// Pending characters that might be the start of a `<think>` or `</think>`
    /// tag (held back until we know for sure).
    pending: String,
}

impl ThinkSplitter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Feed one chunk; returns ordered (is_reasoning, text) segments.
    pub fn feed(&mut self, chunk: &str) -> Vec<(bool, String)> {
        let mut input = std::mem::take(&mut self.pending);
        input.push_str(chunk);
        let mut out: Vec<(bool, String)> = Vec::new();
        let mut buf = String::new();
        let bytes = input.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            let rest = &input[i..];
            let needle = if self.inside { "</think>" } else { "<think>" };
            if rest.starts_with(needle) {
                if !buf.is_empty() {
                    out.push((self.inside, std::mem::take(&mut buf)));
                }
                self.inside = !self.inside;
                i += needle.len();
                continue;
            }
            // If the rest could be the start of either tag, hold it for next chunk.
            if rest.len() < needle.len() && needle.starts_with(rest) {
                self.pending = rest.to_owned();
                break;
            }
            // Also hold for the *other* tag possibility (so we don't emit `<` then
            // discover `<think>` next chunk).
            let other = if self.inside { "<think>" } else { "</think>" };
            if rest.len() < other.len() && other.starts_with(rest) {
                self.pending = rest.to_owned();
                break;
            }
            // Otherwise consume one char.
            let ch = rest.chars().next().unwrap();
            buf.push(ch);
            i += ch.len_utf8();
        }
        if !buf.is_empty() {
            out.push((self.inside, buf));
        }
        out
    }
}

pub async fn stream_chat(
    client: &Client,
    api_key: &str,
    base_url: &str,
    model: &str,
    messages: &[ChatMessage],
    tools: &[Value],
) -> Result<impl Stream<Item = Result<OpenAiEvent>> + use<>> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let mut body = serde_json::json!({
        "model": model,
        "stream": true,
        "messages": messages,
    });
    // Only include tools/tool_choice when there are actual tools defined.
    // Sending tool_choice:"auto" with an empty array is rejected by many providers.
    if !tools.is_empty() {
        body["tools"] = serde_json::json!(tools);
        body["tool_choice"] = serde_json::json!("auto");
    }

    let response = client
        .post(&url)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .context("sending chat completions request")?;

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
        let mut splitter = ThinkSplitter::new();

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

                    // DeepSeek-R1 / o1 / Groq reasoning models emit a separate
                    // `reasoning_content` field (sometimes `reasoning`).
                    if let Some(text) = delta
                        .and_then(|d| d.get("reasoning_content").or_else(|| d.get("reasoning")))
                        .and_then(|c| c.as_str())
                    {
                        if !text.is_empty() {
                            yield OpenAiEvent::ReasoningDelta(text.to_owned());
                        }
                    }

                    if let Some(text) = delta
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        if !text.is_empty() {
                            // MiniMax / Qwen-thinking emit thinking inline as
                            // <think>...</think> inside content. Split it out.
                            for (is_reasoning, segment) in splitter.feed(text) {
                                if segment.is_empty() {
                                    continue;
                                }
                                if is_reasoning {
                                    yield OpenAiEvent::ReasoningDelta(segment);
                                } else {
                                    yield OpenAiEvent::TextDelta(segment);
                                }
                            }
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
