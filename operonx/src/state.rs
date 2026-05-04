use sqlx::{Pool, Postgres};

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: Pool<Postgres>,
}
