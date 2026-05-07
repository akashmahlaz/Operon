//! HTTP routes for browsing coding conversations + their persisted messages.
//!
//!   GET /agent/conversations            list user's coding conversations
//!   GET /agent/conversations/:id        single conversation + messages

use axum::{
    Json,
    extract::{Path, Query, State},
    http::HeaderMap,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
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
    let channel = query.channel.as_deref().map(str::trim).filter(|v| !v.is_empty());
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
    Ok(Json(ConversationDetail {
        messages,
        ..detail
    }))
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
