use axum::{Json, body::Bytes};
use serde_json::json;

use crate::http::error::AppResult;

pub async fn create_upload(body: Bytes) -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "url": "operon://local-upload",
        "publicUrl": "operon://local-upload",
        "size": body.len()
    })))
}
