//! Per-run agent task: drives the LLM ↔ tool loop and broadcasts AI SDK
//! UI Message Stream Protocol frames.

use std::sync::Arc;

use anyhow::{Context, Result};
use chrono::Utc;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{Value, json};
use sqlx::{Pool, Postgres};
use tokio::sync::{Mutex, broadcast};
use uuid::Uuid;

use super::{
    events,
    openai::{self, ChatMessage, OpenAiEvent, ToolCall},
    prompt::CODING_SYSTEM_PROMPT,
    tools::{self, Workspace},
    types::{AgentEvent, RunId, RunStatus},
};

const MAX_STEPS: usize = 24;
const BROADCAST_CAPACITY: usize = 1024;

#[derive(Clone)]
pub struct RunHandle {
    pub run_id: RunId,
    pub user_id: Uuid,
    pub conversation_id: Uuid,
    pub broadcast: broadcast::Sender<AgentEvent>,
    sequence: Arc<Mutex<i64>>,
    db: Pool<Postgres>,
}

impl RunHandle {
    fn new(run_id: RunId, user_id: Uuid, conversation_id: Uuid, db: Pool<Postgres>) -> Self {
        let (tx, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self {
            run_id,
            user_id,
            conversation_id,
            broadcast: tx,
            sequence: Arc::new(Mutex::new(0)),
            db,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<AgentEvent> {
        self.broadcast.subscribe()
    }

    /// Persist + broadcast an AI-SDK frame.
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
}

pub fn spawn(spec: RunnerSpec) -> RunHandle {
    let handle = RunHandle::new(
        spec.run_id,
        spec.user_id,
        spec.conversation_id,
        spec.db.clone(),
    );
    let task_handle = handle.clone();
    let db = spec.db.clone();
    tokio::spawn(async move {
        if let Err(err) = run(spec, task_handle.clone()).await {
            tracing::warn!(run_id = %task_handle.run_id, error = %err, "agent run errored");
            let _ = task_handle.emit(&events::error(&err.to_string())).await;
            let _ = set_status(
                &db,
                task_handle.run_id,
                RunStatus::Failed,
                Some(err.to_string()),
            )
            .await;
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

    let mut messages: Vec<ChatMessage> = vec![
        ChatMessage {
            role: "system".to_owned(),
            content: Some(format!(
                "{}\n\nWorkspace root: {}",
                CODING_SYSTEM_PROMPT,
                spec.workspace.root().display()
            )),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        },
        ChatMessage {
            role: "user".to_owned(),
            content: Some(spec.initial_user_message.clone()),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        },
    ];

    let tool_definitions = tools::tool_definitions();

    let message_id = format!("msg-{}", Uuid::now_v7());
    handle.emit(&events::start(&message_id)).await?;

    for step in 0..MAX_STEPS {
        handle.emit(&events::start_step()).await?;

        let stream = openai::stream_chat(
            &client,
            &spec.openai_api_key,
            &spec.model,
            &messages,
            &tool_definitions,
        )
        .await?;
        tokio::pin!(stream);

        let text_id = format!("text-{step}");
        let mut text_started = false;
        let mut accumulated_text = String::new();
        let mut tool_call_started: Vec<bool> = Vec::new();
        let mut final_tool_calls: Vec<ToolCall> = Vec::new();
        let mut finish_reason = String::new();

        while let Some(event) = stream.next().await {
            let event = event?;
            match event {
                OpenAiEvent::TextDelta(delta) => {
                    if !text_started {
                        handle.emit(&events::text_start(&text_id)).await?;
                        text_started = true;
                    }
                    accumulated_text.push_str(&delta);
                    handle.emit(&events::text_delta(&text_id, &delta)).await?;
                }
                OpenAiEvent::ToolCallBegin { index, id, name } => {
                    while tool_call_started.len() <= index {
                        tool_call_started.push(false);
                    }
                    if !tool_call_started[index] {
                        handle.emit(&events::tool_input_start(&id, &name)).await?;
                        tool_call_started[index] = true;
                    }
                }
                OpenAiEvent::ToolCallArgsDelta { index: _, delta } => {
                    handle.emit(&events::tool_input_delta("", &delta)).await?;
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
            handle.emit(&events::text_end(&text_id)).await?;
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
        persist_message(
            &spec.db,
            &spec.conversation_id,
            &spec.user_id,
            &assistant_message,
        )
        .await?;
        messages.push(assistant_message);

        if final_tool_calls.is_empty() || finish_reason == "stop" {
            handle.emit(&events::finish_step()).await?;
            handle.emit(&events::finish()).await?;
            set_status(&spec.db, spec.run_id, RunStatus::Completed, None).await?;
            return Ok(());
        }

        for tc in &final_tool_calls {
            let parsed_input: Value =
                serde_json::from_str(&tc.function.arguments).unwrap_or(json!({}));
            handle
                .emit(&events::tool_input_available(
                    &tc.id,
                    &tc.function.name,
                    &parsed_input,
                ))
                .await?;

            let dispatch_result =
                tools::dispatch(&spec.workspace, &tc.function.name, &parsed_input).await;
            let result_value = match dispatch_result {
                Ok(value) => {
                    handle
                        .emit(&events::tool_output_available(&tc.id, &value))
                        .await?;
                    value
                }
                Err(err) => {
                    let text = err.to_string();
                    handle
                        .emit(&events::tool_output_error(&tc.id, &text))
                        .await?;
                    json!({ "error": text })
                }
            };

            let tool_message = ChatMessage {
                role: "tool".to_owned(),
                content: Some(result_value.to_string()),
                name: Some(tc.function.name.clone()),
                tool_call_id: Some(tc.id.clone()),
                tool_calls: None,
            };
            persist_message(
                &spec.db,
                &spec.conversation_id,
                &spec.user_id,
                &tool_message,
            )
            .await?;
            messages.push(tool_message);
        }

        handle.emit(&events::finish_step()).await?;
    }

    handle.emit(&events::finish()).await?;
    set_status(&spec.db, spec.run_id, RunStatus::Completed, None).await?;
    Ok(())
}

async fn persist_message(
    db: &Pool<Postgres>,
    conversation_id: &Uuid,
    user_id: &Uuid,
    message: &ChatMessage,
) -> Result<()> {
    let parts = serde_json::to_value(message).unwrap_or_else(|_| json!({}));
    sqlx::query(
        "insert into messages (id, conversation_id, user_id, role, content, parts) values ($1, $2, $3, $4, $5, $6)",
    )
    .bind(Uuid::now_v7())
    .bind(conversation_id)
    .bind(user_id)
    .bind(&message.role)
    .bind(message.content.clone().unwrap_or_default())
    .bind(parts)
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

/// Replay persisted events for SSE resume.
pub async fn load_events_since(
    db: &Pool<Postgres>,
    run_id: RunId,
    since_sequence: i64,
) -> Result<Vec<AgentEvent>> {
    use sqlx::Row;
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
