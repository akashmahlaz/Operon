mod auth;
mod error;
mod health;

use axum::{
    Router,
    http::HeaderValue,
    routing::{get, post},
};
use tower_http::cors::{Any, CorsLayer};

use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(health::healthz))
        .route("/readyz", get(health::readyz))
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
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true)
}
