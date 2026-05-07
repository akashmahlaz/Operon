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
    anthropic,
    events,
    openai::{self, ChatMessage, OpenAiEvent, ToolCall, ToolCallFunction},
    prompt::build_system_message,
    tools::{self, AgentContext, Workspace},
    types::{AgentEvent, RunId, RunStatus},
};

/// Build a present-tense + past-tense pair for a tool call so the UI can
/// show "Reading file `foo.ts`…" while running and "Read file `foo.ts`"
/// after. Mirrors Copilot's `invocationMessage` / `pastTenseMessage`.
fn tool_messages(name: &str, args: &Value) -> (String, String) {
    let target = args
        .get("path")
        .or_else(|| args.get("target"))
        .or_else(|| args.get("query"))
        .or_else(|| args.get("command"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let target_md = if target.is_empty() {
        String::new()
    } else {
        format!(" `{}`", target)
    };
    let owner = args.get("owner").and_then(|v| v.as_str()).unwrap_or("");
    let repo = args.get("repo").and_then(|v| v.as_str()).unwrap_or("");
    let repo_target = if owner.is_empty() || repo.is_empty() {
        String::new()
    } else {
        format!(" `{}/{}`", owner, repo)
    };
    let repo_path_target = if owner.is_empty() || repo.is_empty() || target.is_empty() {
        repo_target.clone()
    } else {
        format!(" `{}/{}/{}`", owner, repo, target)
    };
    match name {
        "read_file" => (
            format!("Reading{}", target_md),
            format!("Read{}", target_md),
        ),
        "write_file" => (
            format!("Writing{}", target_md),
            format!("Wrote{}", target_md),
        ),
        "apply_patch" => (
            "Applying edits".to_owned(),
            "Applied edits".to_owned(),
        ),
        "list_dir" => (
            format!("Listing{}", target_md),
            format!("Listed{}", target_md),
        ),
        "search" => (
            format!("Searching{}", target_md),
            format!("Searched{}", target_md),
        ),
        "exec" => (
            format!("Running{}", target_md),
            format!("Ran{}", target_md),
        ),
        "github_get_status" => (
            "Checking GitHub connection".to_owned(),
            "Checked GitHub connection".to_owned(),
        ),
        "github_list_repos" => (
            "Listing your repositories".to_owned(),
            "Listed your repositories".to_owned(),
        ),
        "github_get_repo" => (
            format!("Reading{}", repo_target),
            format!("Read{}", repo_target),
        ),
        "github_list_contents" => (
            format!("Listing{}", repo_path_target),
            format!("Listed{}", repo_path_target),
        ),
        "github_read_file" => (
            format!("Reading{}", repo_path_target),
            format!("Read{}", repo_path_target),
        ),
        "github_search_code" => (
            format!("Searching GitHub code{}", target_md),
            format!("Searched GitHub code{}", target_md),
        ),
        "github_list_branches" => (
            format!("Listing branches{}", repo_target),
            format!("Listed branches{}", repo_target),
        ),
        "github_list_issues" => (
            format!("Listing issues{}", repo_target),
            format!("Listed issues{}", repo_target),
        ),
        "github_list_pull_requests" => (
            format!("Listing pull requests{}", repo_target),
            format!("Listed pull requests{}", repo_target),
        ),
        other => (
            format!("Running `{}`", other),
            format!("Ran `{}`", other),
        ),
    }
}

fn normalize_tool_arguments(arguments: &str) -> Value {
    let trimmed = arguments.trim();
    if trimmed.is_empty() {
        return json!({});
    }

    match serde_json::from_str::<Value>(trimmed) {
        Ok(value) if value.is_object() => value,
        Ok(_) | Err(_) => json!({}),
    }
}

fn canonical_tool_call(tool_call: &ToolCall) -> ToolCall {
    let mut normalized = tool_call.clone();
    normalized.function.arguments = normalize_tool_arguments(&tool_call.function.arguments).to_string();
    normalized
}

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
    pub provider: String,
    pub model: String,
    pub openai_api_key: String,
    pub base_url: String,
    pub workspace: Workspace,
    pub github_token: Option<String>,
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

    let agent_ctx = AgentContext::new(
        spec.workspace.clone(),
        client.clone(),
        spec.github_token.clone(),
    );

    let mut messages: Vec<ChatMessage> = Vec::new();
    messages.push(ChatMessage {
        role: "system".to_owned(),
        content: Some(build_system_message(&spec.workspace)),
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

        let stream = if spec.provider == "anthropic" {
            let s = anthropic::stream_chat(
                &client,
                &spec.openai_api_key,
                &spec.model,
                &messages,
                &tool_definitions,
            )
            .await?;
            futures::future::Either::Left(s)
        } else {
            let s = openai::stream_chat(
                &client,
                &spec.openai_api_key,
                &spec.base_url,
                &spec.model,
                &messages,
                &tool_definitions,
            )
            .await?;
            futures::future::Either::Right(s)
        };
        tokio::pin!(stream);

        let mut text_started = false;
        let mut accumulated_text = String::new();
        let mut accumulated_reasoning = String::new();
        let mut reasoning_id: Option<String> = None;
        let mut tool_call_started: Vec<bool> = Vec::new();
        let mut final_tool_calls: Vec<ToolCall> = Vec::new();
        let mut finish_reason = String::new();

        while let Some(event) = stream.next().await {
            if handle.cancel.is_cancelled() {
                anyhow::bail!("run cancelled");
            }
            let event = event?;
            match event {
                OpenAiEvent::ReasoningDelta(delta) => {
                    let id = match reasoning_id.as_ref() {
                        Some(id) => id.clone(),
                        None => {
                            let id = Uuid::now_v7().to_string();
                            handle.emit(&events::reasoning_start(&id)).await?;
                            reasoning_id = Some(id.clone());
                            id
                        }
                    };
                    accumulated_reasoning.push_str(&delta);
                    handle.emit(&events::reasoning_delta(&id, &delta)).await?;
                }
                OpenAiEvent::TextDelta(delta) => {
                    if let Some(id) = reasoning_id.take() {
                        handle.emit(&events::reasoning_end(&id)).await?;
                    }
                    text_started = true;
                    accumulated_text.push_str(&delta);
                    handle.emit(&events::text_delta(&delta)).await?;
                }
                OpenAiEvent::ToolCallBegin { index, id, name } => {
                    if let Some(rid) = reasoning_id.take() {
                        handle.emit(&events::reasoning_end(&rid)).await?;
                    }
                    while tool_call_started.len() <= index {
                        tool_call_started.push(false);
                    }
                    if !tool_call_started[index] {
                        // Args aren't streamed yet — emit start with the
                        // tool name only; runner will follow up with
                        // tool-call-update once args parse.
                        let (invocation, _past) =
                            tool_messages(&name, &serde_json::Value::Null);
                        handle
                            .emit(&events::tool_call_start(
                                &id,
                                &name,
                                Some(&invocation),
                                None,
                            ))
                            .await?;
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

        if let Some(id) = reasoning_id.take() {
            handle.emit(&events::reasoning_end(&id)).await?;
        }
        if text_started {
            handle.emit(&events::text_end()).await?;
        }

        // Build UI parts for this assistant turn (reasoning + text + per-tool-call parts).
        let mut assistant_parts: Vec<Value> = Vec::new();
        if !accumulated_reasoning.is_empty() {
            assistant_parts.push(json!({
                "type": "reasoning-delta",
                "text": accumulated_reasoning,
            }));
            assistant_parts.push(json!({
                "type": "reasoning-end",
                "text": "",
            }));
        }
        if !accumulated_text.is_empty() {
            assistant_parts.push(json!({ "type": "text-delta", "text": accumulated_text }));
            assistant_parts.push(json!({ "type": "text-end", "text": "" }));
        }

        let final_tool_calls: Vec<ToolCall> = final_tool_calls
            .iter()
            .map(canonical_tool_call)
            .collect();

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
            let parsed_input: Value = normalize_tool_arguments(&tc.function.arguments);
            let (invocation, past_tense) = tool_messages(&tc.function.name, &parsed_input);
            // Update the card with a richer invocation message now that we
            // have the parsed args.
            handle
                .emit(&events::tool_call_update(
                    &tc.id,
                    Some(&invocation),
                    None,
                ))
                .await?;
            handle
                .emit(&events::tool_call_input_available(&tc.id, &parsed_input))
                .await?;
            handle.emit(&events::tool_call_execute(&tc.id)).await?;

            let dispatch_result =
                tools::dispatch(&agent_ctx, &tc.function.name, &parsed_input).await;
            let (result_value, error_text) = match dispatch_result {
                Ok(value) => {
                    handle
                        .emit(&events::tool_call_output_available(
                            &tc.id,
                            &value,
                            Some(&past_tense),
                        ))
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
                "invocationMessage": invocation,
                "pastTenseMessage": past_tense,
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
