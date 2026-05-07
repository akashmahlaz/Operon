//! Per-run agent task: drives the LLM ↔ tool loop, persists every event +
//! every message, and broadcasts SSE frames to subscribed clients.
//!
//! Long-session friendly:
//!   * MAX_STEPS configurable via `OPERON_AGENT_MAX_STEPS` (default 200).
//!   * Conversation history is reloaded from Postgres at the start of each
//!     run so multi-turn sessions keep full context.
//!   * The runner survives client disconnects — its work is independent of
//!     SSE subscribers; clients can resume by replaying from `last_seq`.
//!   * `RunHandle::cancel()` aborts the loop cooperatively.
//!
//! Persistence layout:
//!   `messages.parts` is an array of stream-part shapes (the same shapes the
//!   `useStreamEvents` hydrator consumes), e.g.
//!   `{type:"text-delta", text:"..."}` and
//!   `{type:"tool-call-output-available", toolCallId, toolName, args, result, state:"output-available"}`.
//!   This makes UI reload trivial *and* lets us reconstruct OpenAI ChatMessage
//!   history without a second column.

use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{Value, json};
use sqlx::{Pool, Postgres, Row};
use tokio::sync::{Mutex, broadcast};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::{
    events,
    openai::{self, ChatMessage, OpenAiEvent, ToolCall, ToolCallFunction},
    prompt::CODING_SYSTEM_PROMPT,
    tools::{self, Workspace},
    types::{AgentEvent, RunId, RunStatus},
};

const BROADCAST_CAPACITY: usize = 1024;
const DEFAULT_MAX_STEPS: usize = 200;

#[derive(Clone)]
pub struct RunHandle {
    pub run_id: RunId,
    pub broadcast: broadcast::Sender<AgentEvent>,
    pub cancel: CancellationToken,
    sequence: Arc<Mutex<i64>>,
    db: Pool<Postgres>,
}

impl RunHandle {
    fn new(run_id: RunId, db: Pool<Postgres>) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            run_id,
            broadcast: tx,
            cancel: CancellationToken::new(),
            sequence: Arc::new(Mutex::new(0)),
            db,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AgentEvent> {
        self.broadcast.subscribe()
    }

    pub fn cancel(&self) {
        self.cancel.cancel();
    }

    pub async fn emit(&self, frame: &Value) -> Result<()> {
        let mut seq_guard = self.sequence.lock().await;
        *seq_guard += 1;
        let sequence = *seq_guard;
        drop(seq_guard);

        let event_type = frame
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");

        sqlx::query(
            "insert into run_events (id, run_id, sequence, event_type, payload) values ($1, $2, $3, $4, $5)",
        )
        .bind(Uuid::now_v7())
        .bind(self.run_id)
        .bind(sequence)
        .bind(event_type)
        .bind(frame)
        .execute(&self.db)
        .await
        .context("inserting run_event")?;

        let _ = self.broadcast.send(AgentEvent {
            sequence,
            frame: frame.clone(),
        });
        Ok(())
    }
}

pub struct RunnerSpec {
    pub run_id: RunId,
    pub user_id: Uuid,
    pub conversation_id: Uuid,
    pub model: String,
    pub openai_api_key: String,
    pub workspace: Workspace,
    pub initial_user_message: String,
    pub db: Pool<Postgres>,
    pub max_steps: usize,
}

pub fn spawn(spec: RunnerSpec) -> RunHandle {
    let handle = RunHandle::new(spec.run_id, spec.db.clone());
    let task_handle = handle.clone();
    let db = spec.db.clone();
    tokio::spawn(async move {
        let cancel = task_handle.cancel.clone();
        let result = tokio::select! {
            r = run(spec, task_handle.clone()) => r,
            _ = cancel.cancelled() => Err(anyhow::anyhow!("run cancelled by user")),
        };
        if let Err(err) = result {
            tracing::warn!(run_id = %task_handle.run_id, error = %err, "agent run errored");
            let _ = task_handle.emit(&events::error(&err.to_string())).await;
            let _ = task_handle.emit(&events::message_end()).await;
            let final_status = if cancel.is_cancelled() {
                RunStatus::Cancelled
            } else {
                RunStatus::Failed
            };
            let _ = set_status(&db, task_handle.run_id, final_status, Some(err.to_string())).await;
        }
    });
    handle
}

async fn run(spec: RunnerSpec, handle: RunHandle) -> Result<()> {
    set_status(&spec.db, spec.run_id, RunStatus::Running, None).await?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .context("building reqwest client")?;

    let mut messages: Vec<ChatMessage> = Vec::new();
    messages.push(ChatMessage {
        role: "system".to_owned(),
        content: Some(format!(
            "{}\n\nWorkspace root: {}",
            CODING_SYSTEM_PROMPT,
            spec.workspace.root().display()
        )),
        name: None,
        tool_call_id: None,
        tool_calls: None,
    });
    let prior = load_conversation_history(&spec.db, &spec.conversation_id).await?;
    if prior.is_empty() {
        messages.push(ChatMessage {
            role: "user".to_owned(),
            content: Some(spec.initial_user_message.clone()),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        });
    } else {
        messages.extend(prior);
    }

    let tool_definitions = tools::tool_definitions();

    for _step in 0..spec.max_steps {
        if handle.cancel.is_cancelled() {
            anyhow::bail!("run cancelled");
        }

        let stream = openai::stream_chat(
            &client,
            &spec.openai_api_key,
            &spec.model,
            &messages,
            &tool_definitions,
        )
        .await?;
        tokio::pin!(stream);

        let mut text_started = false;
        let mut accumulated_text = String::new();
        let mut tool_call_started: Vec<bool> = Vec::new();
        let mut final_tool_calls: Vec<ToolCall> = Vec::new();
        let mut finish_reason = String::new();

        while let Some(event) = stream.next().await {
            if handle.cancel.is_cancelled() {
                anyhow::bail!("run cancelled");
            }
            let event = event?;
            match event {
                OpenAiEvent::TextDelta(delta) => {
                    text_started = true;
                    accumulated_text.push_str(&delta);
                    handle.emit(&events::text_delta(&delta)).await?;
                }
                OpenAiEvent::ToolCallBegin { index, id, name } => {
                    while tool_call_started.len() <= index {
                        tool_call_started.push(false);
                    }
                    if !tool_call_started[index] {
                        handle.emit(&events::tool_call_start(&id, &name)).await?;
                        tool_call_started[index] = true;
                    }
                }
                OpenAiEvent::Finished {
                    finish_reason: r,
                    tool_calls,
                } => {
                    finish_reason = r;
                    final_tool_calls = tool_calls;
                }
            }
        }

        if text_started {
            handle.emit(&events::text_end()).await?;
        }

        // Build UI parts for this assistant turn (text + per-tool-call parts).
        let mut assistant_parts: Vec<Value> = Vec::new();
        if !accumulated_text.is_empty() {
            assistant_parts.push(json!({ "type": "text-delta", "text": accumulated_text }));
            assistant_parts.push(json!({ "type": "text-end", "text": "" }));
        }

        let assistant_message = ChatMessage {
            role: "assistant".to_owned(),
            content: if accumulated_text.is_empty() {
                None
            } else {
                Some(accumulated_text.clone())
            },
            name: None,
            tool_call_id: None,
            tool_calls: if final_tool_calls.is_empty() {
                None
            } else {
                Some(final_tool_calls.clone())
            },
        };
        messages.push(assistant_message.clone());

        // No tool calls → final answer.
        if final_tool_calls.is_empty() || finish_reason == "stop" {
            persist_message(
                &spec.db,
                &spec.conversation_id,
                Some(&spec.user_id),
                "assistant",
                accumulated_text.as_str(),
                &assistant_parts,
                Some(&spec.model),
            )
            .await?;
            handle.emit(&events::message_end()).await?;
            set_status(&spec.db, spec.run_id, RunStatus::Completed, None).await?;
            return Ok(());
        }

        // Execute every tool call inline; record the invocation + result as
        // a single rich part on the assistant message.
        for tc in &final_tool_calls {
            if handle.cancel.is_cancelled() {
                anyhow::bail!("run cancelled");
            }
            let parsed_input: Value =
                serde_json::from_str(&tc.function.arguments).unwrap_or(json!({}));
            handle
                .emit(&events::tool_call_input_available(&tc.id, &parsed_input))
                .await?;
            handle.emit(&events::tool_call_execute(&tc.id)).await?;

            let dispatch_result =
                tools::dispatch(&spec.workspace, &tc.function.name, &parsed_input).await;
            let (result_value, error_text) = match dispatch_result {
                Ok(value) => {
                    handle
                        .emit(&events::tool_call_output_available(&tc.id, &value))
                        .await?;
                    (value, None)
                }
                Err(err) => {
                    let text = err.to_string();
                    handle
                        .emit(&events::tool_call_output_error(&tc.id, &text))
                        .await?;
                    (json!({ "error": text }), Some(text))
                }
            };
            handle.emit(&events::tool_call_end(&tc.id)).await?;

            assistant_parts.push(json!({
                "type": "tool-call-output-available",
                "toolCallId": tc.id,
                "toolName": tc.function.name,
                "args": parsed_input,
                "result": result_value,
                "errorText": error_text,
                "state": if error_text.is_some() { "output-error" } else { "output-available" },
            }));

            let tool_message = ChatMessage {
                role: "tool".to_owned(),
                content: Some(result_value.to_string()),
                name: Some(tc.function.name.clone()),
                tool_call_id: Some(tc.id.clone()),
                tool_calls: None,
            };
            messages.push(tool_message);
        }

        persist_message(
            &spec.db,
            &spec.conversation_id,
            Some(&spec.user_id),
            "assistant",
            accumulated_text.as_str(),
            &assistant_parts,
            Some(&spec.model),
        )
        .await?;
    }

    handle.emit(&events::message_end()).await?;
    set_status(&spec.db, spec.run_id, RunStatus::Completed, None).await?;
    Ok(())
}

/// Reconstruct the OpenAI ChatMessage history from the persisted UI parts.
async fn load_conversation_history(
    db: &Pool<Postgres>,
    conversation_id: &Uuid,
) -> Result<Vec<ChatMessage>> {
    let rows = sqlx::query(
        "select role, content, parts from messages where conversation_id = $1 order by created_at asc",
    )
    .bind(conversation_id)
    .fetch_all(db)
    .await
    .context("loading conversation history")?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let role: String = row.try_get("role")?;
        let content: String = row.try_get("content")?;
        let parts: Value = row.try_get("parts")?;

        match role.as_str() {
            "user" => out.push(ChatMessage {
                role: "user".to_owned(),
                content: Some(content),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            }),
            "assistant" => {
                let mut tool_calls: Vec<ToolCall> = Vec::new();
                let mut text_buf = String::new();
                if let Some(arr) = parts.as_array() {
                    for part in arr {
                        let kind = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        match kind {
                            "text-delta" => {
                                if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                                    text_buf.push_str(t);
                                }
                            }
                            k if k.starts_with("tool-call") => {
                                let tool_call_id = part
                                    .get("toolCallId")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let tool_name = part
                                    .get("toolName")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let args = part.get("args").cloned().unwrap_or(json!({}));
                                if !tool_call_id.is_empty()
                                    && tool_calls.iter().all(|tc| tc.id != tool_call_id)
                                {
                                    tool_calls.push(ToolCall {
                                        id: tool_call_id.to_owned(),
                                        kind: "function".to_owned(),
                                        function: ToolCallFunction {
                                            name: tool_name.to_owned(),
                                            arguments: args.to_string(),
                                        },
                                    });
                                }
                            }
                            _ => {}
                        }
                    }
                }
                let final_text = if text_buf.is_empty() { content } else { text_buf };
                out.push(ChatMessage {
                    role: "assistant".to_owned(),
                    content: if final_text.is_empty() {
                        None
                    } else {
                        Some(final_text)
                    },
                    name: None,
                    tool_call_id: None,
                    tool_calls: if tool_calls.is_empty() {
                        None
                    } else {
                        // Each assistant turn must be followed by tool messages
                        // for every tool_call. Emit those next.
                        Some(tool_calls.clone())
                    },
                });
                // Emit a tool message per tool call recovered.
                if !tool_calls.is_empty() {
                    if let Some(arr) = parts.as_array() {
                        for part in arr {
                            let kind = part.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if !kind.starts_with("tool-call") {
                                continue;
                            }
                            let tool_call_id = part
                                .get("toolCallId")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let tool_name = part
                                .get("toolName")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");
                            let result = part.get("result").cloned().unwrap_or(json!({}));
                            out.push(ChatMessage {
                                role: "tool".to_owned(),
                                content: Some(result.to_string()),
                                name: Some(tool_name.to_owned()),
                                tool_call_id: Some(tool_call_id.to_owned()),
                                tool_calls: None,
                            });
                        }
                    }
                }
            }
            "tool" => {
                // Skip — tool messages are derived from the preceding assistant
                // message's parts (legacy rows would be tolerated this way).
                continue;
            }
            _ => continue,
        }
    }
    Ok(out)
}

#[allow(clippy::too_many_arguments)]
async fn persist_message(
    db: &Pool<Postgres>,
    conversation_id: &Uuid,
    user_id: Option<&Uuid>,
    role: &str,
    content: &str,
    parts: &[Value],
    model: Option<&str>,
) -> Result<()> {
    let parts_json = Value::Array(parts.to_vec());
    sqlx::query(
        "insert into messages (id, conversation_id, user_id, role, content, parts, model) values ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::now_v7())
    .bind(conversation_id)
    .bind(user_id)
    .bind(role)
    .bind(content)
    .bind(parts_json)
    .bind(model)
    .execute(db)
    .await
    .context("inserting message")?;
    Ok(())
}

async fn set_status(
    db: &Pool<Postgres>,
    run_id: RunId,
    status: RunStatus,
    last_error: Option<String>,
) -> Result<()> {
    let started_at = if matches!(status, RunStatus::Running) {
        Some(Utc::now())
    } else {
        None
    };
    let completed_at = if matches!(
        status,
        RunStatus::Completed | RunStatus::Failed | RunStatus::Cancelled
    ) {
        Some(Utc::now())
    } else {
        None
    };
    sqlx::query(
        "update runs set status = $2,
             started_at = coalesce(started_at, $3),
             completed_at = coalesce(completed_at, $4),
             last_error = coalesce($5, last_error),
             updated_at = now()
         where id = $1",
    )
    .bind(run_id)
    .bind(status.as_str())
    .bind(started_at)
    .bind(completed_at)
    .bind(last_error)
    .execute(db)
    .await
    .context("updating run status")?;
    Ok(())
}

pub fn default_max_steps() -> usize {
    std::env::var("OPERON_AGENT_MAX_STEPS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(DEFAULT_MAX_STEPS)
}

pub async fn load_events_since(
    db: &Pool<Postgres>,
    run_id: RunId,
    since_sequence: i64,
) -> Result<Vec<AgentEvent>> {
    let rows = sqlx::query(
        "select sequence, payload from run_events where run_id = $1 and sequence > $2 order by sequence asc",
    )
    .bind(run_id)
    .bind(since_sequence)
    .fetch_all(db)
    .await
    .context("loading run_events")?;

    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let sequence: i64 = row.try_get("sequence")?;
        let payload: Value = row.try_get("payload")?;
        out.push(AgentEvent {
            sequence,
            frame: payload,
        });
    }
    Ok(out)
}
