use axum::{Json, extract::Path};
use serde::Deserialize;
use serde_json::json;

use crate::http::error::AppResult;

#[derive(Deserialize)]
pub struct AgentUpdate {
    #[serde(default)]
    enabled: Option<bool>,
}

pub async fn usage_summary() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "summary": {
            "totalRequests": 0,
            "totalTokens": 0,
            "totalPromptTokens": 0,
            "totalCompletionTokens": 0,
            "totalCost": 0,
            "avgDuration": 0,
            "totalToolCalls": 0,
            "errorCount": 0
        },
        "daily": []
    })))
}

pub async fn logs() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "logs": [] })))
}

pub async fn agents() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "agents": [{
            "id": "operon-rust-agent",
            "name": "Operon Rust Agent",
            "description": "Long-running coding agent served by operonx",
            "tools": ["shell", "files", "web"],
            "enabled": true
        }]
    })))
}

pub async fn update_agent(Path(_id): Path<String>, Json(payload): Json<AgentUpdate>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "ok": true, "enabled": payload.enabled.unwrap_or(true) })))
}

pub async fn delete_agent(Path(_id): Path<String>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "ok": true })))
}
