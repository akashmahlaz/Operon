use axum::{Json, extract::Path};
use serde::Deserialize;
use serde_json::json;

use crate::http::error::AppResult;

#[derive(Deserialize)]
pub struct ProviderRequest {
    #[serde(default)]
    action: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default, rename = "baseUrl")]
    base_url: Option<String>,
    #[serde(default, rename = "apiKey")]
    api_key: Option<String>,
    #[serde(default)]
    model: Option<String>,
}

#[derive(Deserialize)]
pub struct WorkspaceFileRequest {
    kind: String,
    content: String,
}

pub async fn providers() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "providers": [],
        "profiles": [],
        "defaultModel": "openai:gpt-4o-mini",
        "recentProviderId": "openai"
    })))
}

pub async fn update_provider(Json(payload): Json<ProviderRequest>) -> AppResult<Json<serde_json::Value>> {
    let provider = payload.provider.unwrap_or_else(|| "openai".to_owned());
    let action = payload.action.unwrap_or_else(|| "connect".to_owned());
    let default_model = payload.model.unwrap_or_else(|| format!("{provider}/gpt-4o-mini"));
    let models = if action == "refresh-models" {
        json!([{ "id": "gpt-4o-mini" }])
    } else {
        json!([])
    };
    Ok(Json(json!({
        "ok": true,
        "models": models,
        "source": "profile",
        "defaultModel": default_model,
        "profile": {
            "profileId": format!("{provider}:api_key"),
            "provider": provider,
            "tokenRef": if payload.api_key.is_some() { "rust-local-secret" } else { "rust-local" },
            "baseUrl": payload.base_url
        }
    })))
}

pub async fn delete_provider_profile(Path((_provider, _profile_id)): Path<(String, String)>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "ok": true })))
}

pub async fn persona() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "persona": null })))
}

pub async fn save_persona(Json(payload): Json<serde_json::Value>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "persona": payload })))
}

pub async fn memory() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "results": [] })))
}

pub async fn delete_memory(Path(_id): Path<String>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "ok": true })))
}

pub async fn workspace_files() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "files": {
            "bootstrap": "",
            "soul": "",
            "user": ""
        }
    })))
}

pub async fn save_workspace_file(Json(payload): Json<WorkspaceFileRequest>) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "ok": true, "kind": payload.kind, "size": payload.content.len() })))
}
