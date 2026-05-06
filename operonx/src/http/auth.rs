use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, header},
};
use base64ct::{Base64UrlUnpadded, Encoding};
use chrono::{Duration, Utc};
use hmac::{Hmac, Mac};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::{Error as SqlxError, Row};
use uuid::Uuid;

use crate::{
    http::error::{AppError, AppResult},
    state::AppState,
};

const ACCESS_COOKIE: &str = "operon_access_token";
const TOKEN_VERSION: &str = "v1";

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub struct SignupRequest {
    email: String,
    password: String,
    display_name: Option<String>,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    user: UserResponse,
    access_token: String,
    expires_at: i64,
}

#[derive(Serialize)]
pub struct UserResponse {
    id: Uuid,
    email: String,
    display_name: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: Uuid,
    email: String,
    exp: usize,
    iat: usize,
}

struct UserRecord {
    id: Uuid,
    email: String,
    display_name: Option<String>,
    password_hash: Option<String>,
}

pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> AppResult<(HeaderMap, Json<AuthResponse>)> {
    validate_email_password(&payload.email, &payload.password)?;

    let user_id = Uuid::now_v7();
    let password_hash = hash_password(&payload.password)?;

    let result = sqlx::query(
        "insert into users (id, email, display_name, password_hash) values ($1, lower($2), $3, $4) returning id, email, display_name, password_hash",
    )
    .bind(user_id)
    .bind(payload.email.trim())
    .bind(payload.display_name.as_deref().map(str::trim).filter(|value| !value.is_empty()))
    .bind(password_hash)
    .fetch_one(&state.db)
    .await;

    let row = match result {
        Ok(row) => row,
        Err(SqlxError::Database(error)) if error.constraint() == Some("users_email_key") => {
            return Err(AppError::Conflict("email already exists".to_owned()));
        }
        Err(error) => return Err(error.into()),
    };

    let user = user_from_row(row)?;
    issue_auth_response(&state, user)
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> AppResult<(HeaderMap, Json<AuthResponse>)> {
    validate_email(&payload.email)?;

    let user = find_user_by_email(&state, &payload.email).await?;
    let password_hash = user
        .password_hash
        .as_deref()
        .ok_or(AppError::Unauthorized)?;
    verify_password(password_hash, &payload.password)?;

    issue_auth_response(&state, user)
}

pub async fn logout() -> AppResult<(HeaderMap, Json<serde_json::Value>)> {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        clear_cookie_header()?
            .parse()
            .map_err(|_| AppError::Internal)?,
    );

    Ok((headers, Json(serde_json::json!({ "ok": true }))))
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Json<UserResponse>> {
    let token = token_from_headers(&headers).ok_or(AppError::Unauthorized)?;
    let claims = decode_claims(&state, token)?;

    let row = sqlx::query("select id, email, display_name, password_hash from users where id = $1")
        .bind(claims.sub)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    Ok(Json(user_response(user_from_row(row)?)))
}

fn validate_email_password(email: &str, password: &str) -> AppResult<()> {
    validate_email(email)?;
    if password.len() < 12 {
        return Err(AppError::BadRequest(
            "password must be at least 12 characters".to_owned(),
        ));
    }
    Ok(())
}

fn validate_email(email: &str) -> AppResult<()> {
    let email = email.trim();
    if email.len() < 3 || !email.contains('@') {
        return Err(AppError::BadRequest("valid email is required".to_owned()));
    }
    Ok(())
}

fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

fn verify_password(password_hash: &str, password: &str) -> AppResult<()> {
    let parsed_hash = PasswordHash::new(password_hash)?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)
}

async fn find_user_by_email(state: &AppState, email: &str) -> AppResult<UserRecord> {
    let row = sqlx::query(
        "select id, email, display_name, password_hash from users where email = lower($1)",
    )
    .bind(email.trim())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Unauthorized)?;

    user_from_row(row)
}

fn user_from_row(row: sqlx::postgres::PgRow) -> AppResult<UserRecord> {
    Ok(UserRecord {
        id: row.try_get("id")?,
        email: row.try_get("email")?,
        display_name: row.try_get("display_name")?,
        password_hash: row.try_get("password_hash")?,
    })
}

fn issue_auth_response(
    state: &AppState,
    user: UserRecord,
) -> AppResult<(HeaderMap, Json<AuthResponse>)> {
    let now = Utc::now();
    let expires_at = now + Duration::seconds(state.config.access_token_ttl_seconds);
    let claims = Claims {
        sub: user.id,
        email: user.email.clone(),
        iat: now.timestamp() as usize,
        exp: expires_at.timestamp() as usize,
    };
    let token = encode_claims(&state.config.jwt_secret, &claims)?;

    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        access_cookie_header(
            &token,
            state.config.access_token_ttl_seconds,
            state.config.cookie_secure,
        )?
        .parse()
        .map_err(|_| AppError::Internal)?,
    );

    Ok((
        headers,
        Json(AuthResponse {
            user: user_response(user),
            access_token: token,
            expires_at: expires_at.timestamp(),
        }),
    ))
}

fn user_response(user: UserRecord) -> UserResponse {
    UserResponse {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
    }
}

fn decode_claims(state: &AppState, token: &str) -> AppResult<Claims> {
    let (version, claims_part, signature_part) = parse_token(token)?;
    if version != TOKEN_VERSION {
        return Err(AppError::Unauthorized);
    }

    let signed_payload = format!("{version}.{claims_part}");
    let expected_signature = sign(&state.config.jwt_secret, signed_payload.as_bytes())?;
    if expected_signature != signature_part {
        return Err(AppError::Unauthorized);
    }

    let claims_bytes =
        Base64UrlUnpadded::decode_vec(claims_part).map_err(|_| AppError::Unauthorized)?;
    let claims: Claims =
        serde_json::from_slice(&claims_bytes).map_err(|_| AppError::Unauthorized)?;
    if claims.exp < Utc::now().timestamp() as usize {
        return Err(AppError::Unauthorized);
    }

    Ok(claims)
}

fn encode_claims(secret: &str, claims: &Claims) -> AppResult<String> {
    let claims_json = serde_json::to_vec(claims).map_err(|_| AppError::Internal)?;
    let claims_part = Base64UrlUnpadded::encode_string(&claims_json);
    let signed_payload = format!("{TOKEN_VERSION}.{claims_part}");
    let signature = sign(secret, signed_payload.as_bytes())?;

    Ok(format!("{signed_payload}.{signature}"))
}

fn sign(secret: &str, payload: &[u8]) -> AppResult<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| AppError::Internal)?;
    mac.update(payload);
    Ok(Base64UrlUnpadded::encode_string(
        &mac.finalize().into_bytes(),
    ))
}

fn parse_token(token: &str) -> AppResult<(&str, &str, &str)> {
    let mut parts = token.split('.');
    let version = parts.next().ok_or(AppError::Unauthorized)?;
    let claims = parts.next().ok_or(AppError::Unauthorized)?;
    let signature = parts.next().ok_or(AppError::Unauthorized)?;

    if parts.next().is_some() {
        return Err(AppError::Unauthorized);
    }

    Ok((version, claims, signature))
}

/// Bearer header → cookie → optional query-string fallback.
pub fn token_from_request<'a>(
    headers: &'a HeaderMap,
    fallback: Option<&'a str>,
) -> Option<&'a str> {
    if let Some(token) = token_from_headers(headers) {
        return Some(token);
    }
    fallback.map(|t| t.trim()).filter(|t| !t.is_empty())
}

/// Verify token + return the user id (`sub` claim).
pub fn decode_claims_public(
    state: &AppState,
    token: &str,
) -> AppResult<Uuid> {
    Ok(decode_claims(state, token)?.sub)
}

fn token_from_headers(headers: &HeaderMap) -> Option<&str> {
    if let Some(header_value) = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    {
        if let Some(token) = header_value.strip_prefix("Bearer ") {
            return Some(token.trim());
        }
    }

    headers
        .get(header::COOKIE)
        .and_then(|value| value.to_str().ok())
        .and_then(|cookies| {
            cookies.split(';').find_map(|cookie| {
                let (name, value) = cookie.trim().split_once('=')?;
                (name == ACCESS_COOKIE).then_some(value)
            })
        })
}

fn access_cookie_header(token: &str, max_age_seconds: i64, secure: bool) -> AppResult<String> {
    let secure = if secure { "; Secure" } else { "" };
    Ok(format!(
        "{ACCESS_COOKIE}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age_seconds}{secure}"
    ))
}

fn clear_cookie_header() -> AppResult<String> {
    Ok(format!(
        "{ACCESS_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
    ))
}
