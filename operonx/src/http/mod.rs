mod auth;
mod codex;
mod error;
mod health;

use axum::{
    Router,
    http::{HeaderValue, Method, header},
    routing::{get, post},
};
use tower_http::cors::CorsLayer;

use crate::state::AppState;

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
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true)
}
