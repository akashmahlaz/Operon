use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::http::error::AppResult;

#[derive(Deserialize)]
pub struct IntegrationAction {
    #[serde(default)]
    action: Option<String>,
    #[serde(default, rename = "phoneType")]
    phone_type: Option<String>,
    #[serde(default, rename = "dmPolicy")]
    dm_policy: Option<String>,
    #[serde(default, rename = "allowFrom")]
    allow_from: Vec<String>,
}

pub async fn whatsapp_status() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "connected": false })))
}

pub async fn telegram_status() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({ "connected": false })))
}

pub async fn whatsapp_onboarding() -> AppResult<Json<serde_json::Value>> {
    Ok(Json(json!({
        "phoneType": null,
        "dmPolicy": "pairing",
        "allowFrom": []
    })))
}

pub async fn whatsapp_action(Json(payload): Json<IntegrationAction>) -> AppResult<Json<serde_json::Value>> {
    let action = payload.action.as_deref().unwrap_or("status");
    let response = match action {
        "qr" => json!({
            "sessionId": "local-rust-session",
            "qrDataUrl": null,
            "message": "WhatsApp pairing is handled by the Rust backend. Configure the adapter process to enable QR pairing."
        }),
        "disconnect" => json!({ "ok": true, "connected": false }),
        "onboarding" => json!({
            "ok": true,
            "phoneType": payload.phone_type,
            "dmPolicy": payload.dm_policy.unwrap_or_else(|| "pairing".to_owned()),
            "allowFrom": payload.allow_from
        }),
        _ => json!({ "ok": true, "connected": false }),
    };
    Ok(Json(response))
}
