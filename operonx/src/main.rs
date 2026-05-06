mod agent;
mod codex;
mod config;
mod db;
mod http;
mod state;

use anyhow::Result;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt};

use crate::{agent::AgentRegistry, codex::CodexBridge, config::Config, state::AppState};

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();
    init_tracing();

    let config = Config::from_env()?;
    let pool = db::connect(&config.database_url).await?;
    db::migrate(&pool).await?;

    let state = AppState {
        codex: CodexBridge::new(config.codex_command.clone()),
        agents: AgentRegistry::new(),
        config: config.clone(),
        db: pool,
    };

    let app = http::router(state).layer(TraceLayer::new_for_http());
    let listener = TcpListener::bind(config.bind_addr).await?;

    tracing::info!(addr = %config.bind_addr, "operonx api listening");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn init_tracing() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("operonx=debug,tower_http=info,sqlx=warn"));

    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer())
        .init();
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
