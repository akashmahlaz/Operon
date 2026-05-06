use std::{env, net::SocketAddr};

use anyhow::{Context, Result};

#[derive(Clone, Debug)]
pub struct Config {
    pub bind_addr: SocketAddr,
    pub database_url: String,
    pub jwt_secret: String,
    pub web_origin: String,
    pub codex_command: String,
    pub access_token_ttl_seconds: i64,
    pub cookie_secure: bool,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let bind_addr = env::var("OPERON_API_BIND")
            .unwrap_or_else(|_| "127.0.0.1:8080".to_owned())
            .parse()
            .context("OPERON_API_BIND must be a socket address")?;

        let database_url = env::var("DATABASE_URL").context("DATABASE_URL is required")?;
        let jwt_secret = env::var("OPERON_JWT_SECRET").context("OPERON_JWT_SECRET is required")?;
        let web_origin =
            env::var("OPERON_WEB_ORIGIN").unwrap_or_else(|_| "http://localhost:3000".to_owned());
        let codex_command = env::var("OPERON_CODEX_COMMAND").unwrap_or_else(|_| {
            if cfg!(windows) {
                "codex.cmd".to_owned()
            } else {
                "codex".to_owned()
            }
        });
        let access_token_ttl_seconds = env::var("OPERON_ACCESS_TOKEN_TTL_SECONDS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(60 * 60);
        let cookie_secure = env::var("OPERON_COOKIE_SECURE")
            .ok()
            .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
            .unwrap_or(false);

        Ok(Self {
            bind_addr,
            database_url,
            jwt_secret,
            web_origin,
            codex_command,
            access_token_ttl_seconds,
            cookie_secure,
        })
    }
}
