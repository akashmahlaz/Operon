//! HTTP routes for browsing coding conversations + their persisted messages.
//!
//!   GET /agent/conversations            list user's coding conversations
//!   GET /agent/conversations/:id        single conversation + messages

use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
    response::sse::{Event, KeepAlive, Sse},
};
use chrono::{DateTime, Utc};
use futures::{Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;
use std::convert::Infallible;
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;
use uuid::Uuid;

use crate::{
    http::error::{AppError, AppResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct ConversationSummary {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub title: String,
    pub channel: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct MessageRow {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub role: String,
    pub content: String,
    pub parts: Value,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize)]
pub struct ConversationDetail {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub title: String,
    pub channel: String,
    #[serde(rename = "createdAt")]
    pub created_at: DateTime<Utc>,
    #[serde(rename = "updatedAt")]
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<MessageRow>,
}

fn require_user(state: &AppState, headers: &HeaderMap) -> AppResult<Uuid> {
    let token = super::token_from_request(headers, None).ok_or(AppError::Unauthorized)?;
    super::decode_claims_public(state, token)
}

#[derive(Deserialize, Default)]
pub struct ListQuery {
    #[serde(default)]
    pub channel: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateConversationRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateConversationRequest {
    pub title: String,
}

#[derive(Deserialize)]
pub struct AppendMessageRequest {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub parts: Option<Value>,
    #[serde(default)]
    pub model: Option<String>,
}

pub async fn list_conversations(
    State(state): State<AppState>,
    Query(query): Query<ListQuery>,
    headers: HeaderMap,
) -> AppResult<Json<Vec<ConversationSummary>>> {
    let user_id = require_user(&state, &headers)?;
    let channel = query
        .channel
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty());
    let rows = if let Some(channel) = channel {
        sqlx::query(
            "select id, title, channel, created_at, updated_at
                 from conversations
                 where user_id = $1 and channel = $2
                 order by updated_at desc
                 limit 200",
        )
        .bind(user_id)
        .bind(channel)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query(
            "select id, title, channel, created_at, updated_at
                 from conversations
                 where user_id = $1
                 order by updated_at desc
                 limit 200",
        )
        .bind(user_id)
        .fetch_all(&state.db)
        .await?
    };
    let out = rows
        .into_iter()
        .map(|row| {
            Ok::<_, AppError>(ConversationSummary {
                id: row.try_get("id")?,
                title: row.try_get("title")?,
                channel: row.try_get("channel")?,
                created_at: row.try_get("created_at")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    Ok(Json(out))
}

pub async fn create_conversation(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateConversationRequest>,
) -> AppResult<Json<ConversationSummary>> {
    let user_id = require_user(&state, &headers)?;
    let id = Uuid::now_v7();
    let title = payload
        .title
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("New Chat");
    let channel = payload
        .channel
        .as_deref()
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("web");
    let row = sqlx::query(
        "insert into conversations (id, user_id, title, channel)
             values ($1, $2, $3, $4)
             returning id, title, channel, created_at, updated_at",
    )
    .bind(id)
    .bind(user_id)
    .bind(title)
    .bind(channel)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(ConversationSummary {
        id: row.try_get("id")?,
        title: row.try_get("title")?,
        channel: row.try_get("channel")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
    }))
}

pub async fn get_conversation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> AppResult<Json<ConversationDetail>> {
    let user_id = require_user(&state, &headers)?;
    let conv = sqlx::query(
        "select id, user_id, title, channel, created_at, updated_at
             from conversations where id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::BadRequest("unknown conversation".into()))?;
    let owner: Uuid = conv.try_get("user_id")?;
    if owner != user_id {
        return Err(AppError::Unauthorized);
    }
    let detail = ConversationDetail {
        id: conv.try_get("id")?,
        title: conv.try_get("title")?,
        channel: conv.try_get("channel")?,
        created_at: conv.try_get("created_at")?,
        updated_at: conv.try_get("updated_at")?,
        messages: vec![],
    };

    let msg_rows = sqlx::query(
        "select id, role, content, parts, created_at from messages
             where conversation_id = $1 order by created_at asc",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    let messages = msg_rows
        .into_iter()
        .map(|row| {
            Ok::<_, AppError>(MessageRow {
                id: row.try_get("id")?,
                role: row.try_get("role")?,
                content: row.try_get("content")?,
                parts: row.try_get("parts")?,
                created_at: row.try_get("created_at")?,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    Ok(Json(ConversationDetail { messages, ..detail }))
}

pub async fn update_conversation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<UpdateConversationRequest>,
) -> AppResult<Json<Value>> {
    let user_id = require_user(&state, &headers)?;
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(AppError::BadRequest("title required".into()));
    }
    let result = sqlx::query(
        "update conversations set title = $3, updated_at = now()
             where id = $1 and user_id = $2",
    )
    .bind(id)
    .bind(user_id)
    .bind(title.chars().take(80).collect::<String>())
    .execute(&state.db)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("unknown conversation".into()));
    }
    Ok(Json(json!({ "ok": true })))
}

pub async fn delete_conversation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> AppResult<Json<Value>> {
    let user_id = require_user(&state, &headers)?;
    let result = sqlx::query("delete from conversations where id = $1 and user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::BadRequest("unknown conversation".into()));
    }
    Ok(Json(json!({ "ok": true })))
}

pub async fn append_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<AppendMessageRequest>,
) -> AppResult<Json<Value>> {
    let user_id = require_user(&state, &headers)?;
    let owner = sqlx::query("select user_id from conversations where id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::BadRequest("unknown conversation".into()))?;
    let owner_id: Uuid = owner.try_get("user_id")?;
    if owner_id != user_id {
        return Err(AppError::Unauthorized);
    }

    let role = payload.role.trim();
    if !matches!(role, "system" | "user" | "assistant" | "tool") {
        return Err(AppError::BadRequest("invalid role".into()));
    }

    sqlx::query(
        "insert into messages (id, conversation_id, user_id, role, content, parts, model)
             values ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::now_v7())
    .bind(id)
    .bind(user_id)
    .bind(role)
    .bind(payload.content.unwrap_or_default())
    .bind(payload.parts.unwrap_or_else(|| json!([])))
    .bind(payload.model)
    .execute(&state.db)
    .await?;

    sqlx::query("update conversations set updated_at = now() where id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "ok": true })))
}

// ─────────────────────────────────────────────────────────────────────────
// Compact conversation (Copilot-parity for long sessions)
// ─────────────────────────────────────────────────────────────────────────

/// POST /agent/conversations/:id/compact
///
/// Streams the compaction process as Server-Sent Events so the UI can render
/// live progress (loading → summarising → saving → done) instead of blocking
/// on a single REST response. If the user has a configured provider profile
/// for the conversation's last-used model, an LLM-generated summary is
/// streamed token-by-token; otherwise we fall back to a structural heuristic
/// summary (still streamed in chunks for visual continuity).
///
/// Frame shape: `{"type": "...", "data": {...}}` — same envelope as the run
/// SSE stream so the frontend can reuse the same parser.
pub async fn compact_conversation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let user_id = require_user(&state, &headers)?;

    let owner = sqlx::query("select user_id from conversations where id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::BadRequest("unknown conversation".into()))?;
    let owner_id: Uuid = owner.try_get("user_id")?;
    if owner_id != user_id {
        return Err(AppError::Unauthorized);
    }

    let (tx, rx) = mpsc::channel::<Value>(64);
    tokio::spawn(run_compaction(state.clone(), id, user_id, tx));

    let stream = ReceiverStream::new(rx).map(|payload| {
        Ok::<Event, Infallible>(
            Event::default()
                .event("message")
                .data(payload.to_string()),
        )
    });

    Ok(Sse::new(stream).keep_alive(KeepAlive::default()))
}

fn compact_event(kind: &str, data: Value) -> Value {
    json!({ "type": kind, "data": data })
}

async fn run_compaction(
    state: AppState,
    conversation_id: Uuid,
    user_id: Uuid,
    tx: mpsc::Sender<Value>,
) {
    use crate::agent::openai::{self, ChatMessage};

    let send = |evt: Value| {
        let tx = tx.clone();
        async move {
            let _ = tx.send(evt).await;
        }
    };

    send(compact_event(
        "progress",
        json!({ "status": "active", "text": "Loading conversation history" }),
    ))
    .await;

    let rows = match sqlx::query(
        "select id, role, content from messages where conversation_id = $1 order by created_at asc",
    )
    .bind(conversation_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            send(compact_event(
                "stream-error",
                json!({ "message": format!("load messages: {e}") }),
            ))
            .await;
            return;
        }
    };

    if rows.len() <= 8 {
        send(compact_event(
            "done",
            json!({ "ok": true, "compacted": 0, "reason": "nothing to compact" }),
        ))
        .await;
        return;
    }

    let cutoff = rows.len() - 8;
    let to_compact: Vec<&sqlx::postgres::PgRow> = rows.iter().take(cutoff).collect();

    send(compact_event(
        "progress",
        json!({
            "status": "active",
            "text": format!("Summarising {cutoff} earlier message(s)"),
        }),
    ))
    .await;

    // Try LLM-driven summary first (best-effort). Fallback: structural heuristic.
    let mut summary = String::new();
    let mut used_llm = false;

    if let Some((provider, model, api_key)) =
        resolve_summarisation_provider(&state, conversation_id, user_id).await
    {
        let base_url = crate::http::agent::provider_base_url(&provider).to_owned();
        let prompt = build_summarisation_prompt(&to_compact);
        let messages = vec![
            ChatMessage {
                role: "system".into(),
                content: Some(
                    "You compress chat history. Produce a concise (≤200 word) bullet \
                     summary capturing user goals, decisions made, key facts, and any \
                     unresolved questions. Use plain text bullets, no preamble."
                        .into(),
                ),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            },
            ChatMessage {
                role: "user".into(),
                content: Some(prompt),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            },
        ];

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .unwrap_or_default();

        // Only the openai-compat chat completions path is supported here; the
        // Responses API path requires more plumbing and isn't worth it for a
        // best-effort summariser. Provider-specific routing can be added later.
        let stream_res =
            openai::stream_chat(&client, &api_key, &base_url, &model, &messages, &[], None).await;

        match stream_res {
            Ok(stream) => {
                tokio::pin!(stream);
                while let Some(item) = stream.next().await {
                    match item {
                        Ok(openai::OpenAiEvent::TextDelta(t)) => {
                            summary.push_str(&t);
                            send(compact_event("text-delta", json!({ "text": t }))).await;
                        }
                        Ok(openai::OpenAiEvent::Finished { .. }) => break,
                        Ok(_) => {}
                        Err(e) => {
                            send(compact_event(
                                "progress",
                                json!({
                                    "status": "active",
                                    "text": format!("LLM summary failed ({e}); using fallback"),
                                }),
                            ))
                            .await;
                            summary.clear();
                            break;
                        }
                    }
                }
                if !summary.trim().is_empty() {
                    used_llm = true;
                }
            }
            Err(e) => {
                send(compact_event(
                    "progress",
                    json!({
                        "status": "active",
                        "text": format!("LLM unreachable ({e}); using fallback"),
                    }),
                ))
                .await;
            }
        }
    }

    if !used_llm {
        summary = heuristic_summary(&to_compact);
        // Stream the heuristic summary in chunks too, so the UI animates.
        for chunk in summary.split_inclusive('\n') {
            send(compact_event("text-delta", json!({ "text": chunk }))).await;
        }
    }

    send(compact_event("text-end", json!({}))).await;
    send(compact_event(
        "progress",
        json!({ "status": "active", "text": "Saving summary" }),
    ))
    .await;

    let summary_parts = json!([
        { "type": "progress", "text": "Compacted earlier conversation", "status": "complete" },
        { "type": "text-delta", "text": summary.clone() },
        { "type": "text-end", "text": "" }
    ]);

    let persist = async {
        let mut tx = state.db.begin().await?;
        for r in &to_compact {
            let mid: Uuid = r.try_get("id")?;
            sqlx::query("delete from messages where id = $1")
                .bind(mid)
                .execute(&mut *tx)
                .await?;
        }
        sqlx::query(
            "insert into messages (id, conversation_id, user_id, role, content, parts) \
             values ($1, $2, $3, 'system', $4, $5)",
        )
        .bind(Uuid::now_v7())
        .bind(conversation_id)
        .bind(user_id)
        .bind(&summary)
        .bind(&summary_parts)
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        sqlx::query("update conversations set updated_at = now() where id = $1")
            .bind(conversation_id)
            .execute(&state.db)
            .await?;
        Ok::<(), sqlx::Error>(())
    };

    if let Err(e) = persist.await {
        send(compact_event(
            "stream-error",
            json!({ "message": format!("persist summary: {e}") }),
        ))
        .await;
        return;
    }

    send(compact_event(
        "done",
        json!({
            "ok": true,
            "compacted": cutoff,
            "usedLlm": used_llm,
        }),
    ))
    .await;
}

/// Look up the most recent run's model on this conversation and resolve the
/// provider's API key from `provider_profiles`. Returns
/// `Some((provider, model, api_key))` on success, `None` otherwise.
async fn resolve_summarisation_provider(
    state: &AppState,
    conversation_id: Uuid,
    user_id: Uuid,
) -> Option<(String, String, String)> {
    let row = sqlx::query(
        "select model from runs where conversation_id = $1 and model is not null \
         order by created_at desc limit 1",
    )
    .bind(conversation_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()?;
    let model_full: String = row.try_get("model").ok()?;
    let (provider, model_id) = if let Some(slash) = model_full.find('/') {
        (
            model_full[..slash].to_owned(),
            model_full[slash + 1..].to_owned(),
        )
    } else {
        ("openai".to_owned(), model_full)
    };
    // Skip Responses-API-only models (gpt-5, codex) — see comment above.
    if crate::agent::openai::requires_responses_api(&model_id) {
        return None;
    }
    if provider == "anthropic" {
        return None;
    }

    let key_row = sqlx::query(
        "select api_key_ciphertext from provider_profiles where user_id = $1 and provider = $2",
    )
    .bind(user_id)
    .bind(&provider)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    let api_key = key_row
        .and_then(|r| r.try_get::<Option<String>, _>("api_key_ciphertext").ok().flatten())
        .filter(|k| !k.is_empty())
        .or_else(|| state.config.openai_api_key.clone())?;

    Some((provider, model_id, api_key))
}

fn build_summarisation_prompt(rows: &[&sqlx::postgres::PgRow]) -> String {
    let mut buf = String::with_capacity(8 * 1024);
    buf.push_str("Summarise this chat history:\n\n");
    for r in rows {
        let role: String = r.try_get("role").unwrap_or_default();
        let content: String = r.try_get("content").unwrap_or_default();
        let snippet: String = content.chars().take(800).collect();
        buf.push_str(&format!("[{role}] {snippet}\n\n"));
    }
    buf
}

fn heuristic_summary(rows: &[&sqlx::postgres::PgRow]) -> String {
    let user_count = rows
        .iter()
        .filter(|r| r.try_get::<String, _>("role").map(|s| s == "user").unwrap_or(false))
        .count();
    let asst_count = rows
        .iter()
        .filter(|r| r.try_get::<String, _>("role").map(|s| s == "assistant").unwrap_or(false))
        .count();
    let mut snippets: Vec<String> = Vec::new();
    for r in rows.iter().take(6) {
        let role: String = r.try_get("role").unwrap_or_default();
        let content: String = r.try_get("content").unwrap_or_default();
        if role == "user" {
            let s: String = content.chars().take(120).collect();
            snippets.push(format!("- {s}"));
        }
    }
    format!(
        "Earlier in this conversation: {user_count} user message(s) and {asst_count} assistant response(s).\nHighlights:\n{}",
        snippets.join("\n")
    )
}

// ─────────────────────────────────────────────────────────────────────────
// Confirmation reply (Copilot-parity for tool-confirmation prompts)
// ─────────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ConfirmRequest {
    #[serde(rename = "confirmationId")]
    pub confirmation_id: String,
    pub choice: String,
}

/// POST /agent/conversations/:id/confirm
/// Records the user's choice for a confirmation prompt. The runner will
/// pick this up on the next iteration. Currently this just persists the
/// answer as a synthetic user message so the next agent turn sees it.
pub async fn confirm_action(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    headers: HeaderMap,
    Json(payload): Json<ConfirmRequest>,
) -> AppResult<Json<Value>> {
    let user_id = require_user(&state, &headers)?;

    let owner = sqlx::query("select user_id from conversations where id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::BadRequest("unknown conversation".into()))?;
    let owner_id: Uuid = owner.try_get("user_id")?;
    if owner_id != user_id {
        return Err(AppError::Unauthorized);
    }

    let content = format!(
        "Confirmation `{}`: user chose `{}`.",
        payload.confirmation_id, payload.choice
    );
    let parts = json!([
        { "type": "text-delta", "text": content.clone() },
        { "type": "text-end", "text": "" }
    ]);
    sqlx::query(
        "insert into messages (id, conversation_id, user_id, role, content, parts) \
         values ($1, $2, $3, 'system', $4, $5)",
    )
    .bind(Uuid::now_v7())
    .bind(id)
    .bind(user_id)
    .bind(&content)
    .bind(parts)
    .execute(&state.db)
    .await?;

    sqlx::query("update conversations set updated_at = now() where id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(json!({ "ok": true })))
}
