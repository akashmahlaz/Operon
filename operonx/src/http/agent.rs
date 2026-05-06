//! HTTP routes for the coding agent.
//!
//!   POST /agent/runs          → create+spawn a run
//!   GET  /agent/runs/:id/sse  → SSE stream (replay-then-tail)
//!   POST /agent/runs/:id/cancel → request cancellation
//!
//! Auth: same JWT cookie/bearer as the rest of the API.

use std::convert::Infallible;
use std::path::PathBuf;
use std::time::Duration;

use axum::{
    Json,
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::{
        IntoResponse, Response,
        sse::{Event, KeepAlive, Sse},
    },
};
use chrono::Utc;
use futures::stream::{self, Stream, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{
    agent::{
        runner::{self, RunnerSpec},
        tools::Workspace,
        types::{RunRequest, RunStatus},
    },
    http::error::{AppError, AppResult},
    state::AppState,
};

#[derive(Serialize)]
pub struct CreateRunResponse {
    pub run_id: Uuid,
    pub conversation_id: Uuid,
    pub status: &'static str,
    pub model: String,
}

pub async fn create_run(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<RunRequest>,
) -> AppResult<Json<CreateRunResponse>> {
    let user_id = require_user(&state, &headers)?;

    let api_key = state
        .config
        .openai_api_key
        .clone()
        .ok_or_else(|| AppError::ServiceUnavailable("OPENAI_API_KEY not configured".into()))?;

    let model = payload
        .model
        .clone()
        .unwrap_or_else(|| state.config.default_agent_model.clone());

    let prompt = payload.prompt.trim();
    if prompt.is_empty() {
        return Err(AppError::BadRequest("prompt is required".into()));
    }

    let conversation_id = match payload.conversation_id {
        Some(id) => {
            // verify the user owns it
            let row = sqlx::query("select user_id from conversations where id = $1")
                .bind(id)
                .fetch_optional(&state.db)
                .await?;
            match row {
                Some(r) => {
                    use sqlx::Row;
                    let owner: Uuid = r.try_get("user_id")?;
                    if owner != user_id {
                        return Err(AppError::Unauthorized);
                    }
                    id
                }
                None => return Err(AppError::BadRequest("unknown conversation".into())),
            }
        }
        None => {
            let id = Uuid::now_v7();
            sqlx::query(
                "insert into conversations (id, user_id, title, channel) values ($1, $2, $3, 'coding')",
            )
            .bind(id)
            .bind(user_id)
            .bind(truncate_title(prompt))
            .execute(&state.db)
            .await?;
            id
        }
    };

    let run_id = Uuid::now_v7();
    sqlx::query(
        "insert into runs (id, conversation_id, user_id, status, model) values ($1, $2, $3, 'queued', $4)",
    )
    .bind(run_id)
    .bind(conversation_id)
    .bind(user_id)
    .bind(&model)
    .execute(&state.db)
    .await?;

    // persist the initial user message
    sqlx::query(
        "insert into messages (id, conversation_id, user_id, role, content, parts) values ($1, $2, $3, 'user', $4, $5)",
    )
    .bind(Uuid::now_v7())
    .bind(conversation_id)
    .bind(user_id)
    .bind(prompt)
    .bind(json!({ "role": "user", "content": prompt }))
    .execute(&state.db)
    .await?;

    let workspace_root = workspace_path_for(&state, &run_id, payload.workspace.as_deref())?;
    let workspace = Workspace::new(workspace_root)
        .map_err(|e| AppError::ServiceUnavailable(format!("workspace: {e}")))?;

    let handle = runner::spawn(RunnerSpec {
        run_id,
        user_id,
        conversation_id,
        model: model.clone(),
        openai_api_key: api_key,
        workspace,
        initial_user_message: prompt.to_owned(),
        db: state.db.clone(),
        max_steps: runner::default_max_steps(),
    });
    state.agents.insert(handle);

    Ok(Json(CreateRunResponse {
        run_id,
        conversation_id,
        status: RunStatus::Running.as_str(),
        model,
    }))
}

#[derive(Deserialize, Default)]
pub struct SseQuery {
    #[serde(default)]
    last_seq: Option<i64>,
    /// JWT token allowed via query string for EventSource (which can't set headers).
    #[serde(default)]
    token: Option<String>,
}

pub async fn sse_run(
    State(state): State<AppState>,
    Path(run_id): Path<Uuid>,
    Query(query): Query<SseQuery>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, Response> {
    let user_id = match require_user_with_query(&state, &headers, query.token.as_deref()) {
        Ok(id) => id,
        Err(err) => return Err(err.into_response()),
    };

    let owner_check = sqlx::query("select user_id, status from runs where id = $1")
        .bind(run_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| AppError::from(e).into_response())?;

    let (owner, status): (Uuid, String) = match owner_check {
        Some(row) => {
            use sqlx::Row;
            (
                row.try_get("user_id")
                    .map_err(|e| AppError::from(e).into_response())?,
                row.try_get("status")
                    .map_err(|e| AppError::from(e).into_response())?,
            )
        }
        None => return Err(AppError::BadRequest("unknown run".into()).into_response()),
    };
    if owner != user_id {
        return Err(AppError::Unauthorized.into_response());
    }

    let since = query.last_seq.unwrap_or(0);
    let replay = runner::load_events_since(&state.db, run_id, since)
        .await
        .map_err(|e| AppError::ServiceUnavailable(format!("load events: {e}")).into_response())?;

    let live = state.agents.get(&run_id);
    let is_terminal = matches!(
        status.as_str(),
        "completed" | "failed" | "cancelled"
    );

    let replay_stream = stream::iter(replay.into_iter().map(|event| Ok(to_sse_event(event))));

    let combined: futures::stream::BoxStream<'static, Result<Event, Infallible>> =
        if let Some(handle) = live {
            let receiver = handle.subscribe();
            let live_stream = tokio_stream::wrappers::BroadcastStream::new(receiver)
                .filter_map(|item| async move {
                    match item {
                        Ok(event) => Some(Ok(to_sse_event(event))),
                        Err(_) => None, // dropped messages — client can resume by last_seq
                    }
                });
            replay_stream.chain(live_stream).boxed()
        } else if is_terminal {
            // emit a synthetic done so the client closes cleanly
            let done = stream::iter(std::iter::once(Ok(Event::default()
                .event("done")
                .data("{}"))));
            replay_stream.chain(done).boxed()
        } else {
            replay_stream.boxed()
        };

    Ok(Sse::new(combined).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("ping"),
    ))
}

pub async fn cancel_run(
    State(state): State<AppState>,
    Path(run_id): Path<Uuid>,
    headers: HeaderMap,
) -> AppResult<Json<serde_json::Value>> {
    let user_id = require_user(&state, &headers)?;

    let row = sqlx::query("select user_id from runs where id = $1")
        .bind(run_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::BadRequest("unknown run".into()))?;
    use sqlx::Row;
    let owner: Uuid = row.try_get("user_id")?;
    if owner != user_id {
        return Err(AppError::Unauthorized);
    }

    if let Some(handle) = state.agents.get(&run_id) {
        handle.cancel();
    }
    state.agents.remove(&run_id);

    sqlx::query(
        "update runs set status = 'cancelled', completed_at = $2, updated_at = now()
         where id = $1 and status in ('queued','running','paused')",
    )
    .bind(run_id)
    .bind(Utc::now())
    .execute(&state.db)
    .await?;

    Ok(Json(json!({ "ok": true })))
}

fn to_sse_event(event: crate::agent::types::AgentEvent) -> Event {
    Event::default()
        .id(event.sequence.to_string())
        .data(event.frame.to_string())
}

fn truncate_title(text: &str) -> String {
    let trimmed: String = text.chars().take(80).collect();
    if text.chars().count() > 80 {
        format!("{trimmed}…")
    } else {
        trimmed
    }
}

fn workspace_path_for(
    state: &AppState,
    run_id: &Uuid,
    override_path: Option<&str>,
) -> AppResult<PathBuf> {
    if let Some(custom) = override_path {
        let p = PathBuf::from(custom);
        if !p.is_absolute() {
            return Err(AppError::BadRequest("workspace must be absolute".into()));
        }
        return Ok(p);
    }
    Ok(state.config.workspace_root.join(run_id.to_string()))
}

fn require_user(state: &AppState, headers: &HeaderMap) -> AppResult<Uuid> {
    require_user_with_query(state, headers, None)
}

fn require_user_with_query(
    state: &AppState,
    headers: &HeaderMap,
    fallback_token: Option<&str>,
) -> AppResult<Uuid> {
    let token = super::token_from_request(headers, fallback_token).ok_or(AppError::Unauthorized)?;
    super::decode_claims_public(state, token)
}
