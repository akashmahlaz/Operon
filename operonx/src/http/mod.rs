mod admin;
mod agent;
mod auth;
mod codex;
mod conversations;
mod error;
mod health;
mod integrations;
mod settings;
mod uploads;

use axum::{
    Router,
    http::{HeaderValue, Method, header},
    routing::{delete, get, patch, post},
};
use tower_http::cors::CorsLayer;

use crate::state::AppState;

pub use auth::{decode_claims_public, token_from_request};

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
        .route("/codex/healthz", get(codex::healthz))
        .route("/codex/capabilities", get(codex::capabilities))
        .route("/auth/signup", post(auth::signup))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/me", get(auth::me))
        .route("/auth/oauth/google", get(auth::google_oauth_start))
        .route("/auth/oauth/google/callback", get(auth::google_oauth_callback))
        .route("/auth/internal/exchange", post(auth::internal_exchange))
        .route("/agent/runs", post(agent::create_run))
        .route("/agent/runs/{id}/sse", get(agent::sse_run))
        .route("/agent/runs/{id}/cancel", post(agent::cancel_run))
        .route("/agent/conversations", get(conversations::list_conversations).post(conversations::create_conversation))
        .route("/agent/conversations/{id}", get(conversations::get_conversation).patch(conversations::update_conversation).delete(conversations::delete_conversation))
        .route("/agent/conversations/{id}/messages", post(conversations::append_message))
        .route("/integrations/whatsapp/status", get(integrations::whatsapp_status))
        .route("/integrations/telegram/status", get(integrations::telegram_status))
        .route("/integrations/whatsapp/onboarding", get(integrations::whatsapp_onboarding))
        .route("/integrations/whatsapp", post(integrations::whatsapp_action))
        .route("/uploads", post(uploads::create_upload))
        .route("/admin/usage", get(admin::usage_summary))
        .route("/admin/logs", get(admin::logs))
        .route("/admin/agents", get(admin::agents))
        .route("/admin/agents/{id}", patch(admin::update_agent).delete(admin::delete_agent))
        .route("/providers", get(settings::providers).post(settings::update_provider))
        .route("/providers/{provider}/profiles/{profile_id}", delete(settings::delete_provider_profile))
        .route("/persona", get(settings::persona).put(settings::save_persona))
        .route("/memory", get(settings::memory))
        .route("/memory/{id}", delete(settings::delete_memory))
        .route("/workspace-files", get(settings::workspace_files).post(settings::save_workspace_file))
        .with_state(state.clone())
        .layer(cors(state))
}

fn cors(state: AppState) -> CorsLayer {
    let origin: HeaderValue = state
        .config
        .web_origin
        .parse()
        .expect("OPERON_WEB_ORIGIN must be a valid header value");

    CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true)
}
