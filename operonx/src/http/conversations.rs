//! HTTP routes for browsing coding conversations + their persisted messages.
//!
//!   GET /agent/conversations            list user's coding conversations
//!   GET /agent/conversations/:id        single conversation + messages

use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use sqlx::Row;
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

pub async fn list_conversations(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<Vec<ConversationSummary>>> {
    let user_id = require_user(&state, &headers)?;
    let rows = sqlx::query(
        "select id, title, channel, created_at, updated_at
             from conversations
             where user_id = $1 and channel = 'coding'
             order by updated_at desc
             limit 200",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;
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
    Ok(Json(ConversationDetail {
        messages,
        ..detail
    }))
}
