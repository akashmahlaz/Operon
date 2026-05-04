# Operonx

Rust backend for Operon. The Next.js app remains the frontend while backend responsibilities move here.

## Stack

- Axum + Tokio for HTTP and async runtime
- Tower HTTP for tracing and CORS middleware
- SQLx + PostgreSQL for persistence and migrations
- Argon2id PHC password hashes for credentials
- HMAC-SHA256 signed access tokens in HTTP-only cookies
- UUID v7 identifiers for sortable primary keys
- Tracing + env filters for structured runtime diagnostics

## Local Setup

Install PostgreSQL 18 and create an `operon` database. For Windows Rust builds, install either Visual Studio Build Tools with the Visual C++ workload or a GNU toolchain that provides `gcc.exe` and `dlltool.exe`.

Copy `.env.example` to `.env` and update secrets locally.

```powershell
cargo check
cargo run
```

The API listens on `127.0.0.1:8080` by default.

## Initial Routes

- `GET /healthz`
- `GET /readyz`
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

## Migration Direction

The first migration creates the durable core for the app: users, auth sessions, OAuth accounts, provider profiles, conversations, messages, runs, run events, memories, and audit logs. The durable `runs` and `run_events` tables are the base for Copilot-like long-running agent continuity.
