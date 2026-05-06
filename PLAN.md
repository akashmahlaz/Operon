# Operon — Rust Agent Runtime: Research & Plan

> Research date: May 2026. Sources: aisdk.rs, rig.rs (0xPlaygrounds/rig), Tauri v2 docs, crates.io ecosystem scan.

---

## 1. Research: the Rust AI ecosystem in 2026

### 1.1 Two production-grade Rust AI SDKs exist today

#### **aisdk.rs** (lazy-hq/aisdk) — direct Vercel AI SDK port to Rust

- **73+ providers** (OpenAI, Anthropic, Google, xAI, Groq, OpenRouter, DeepSeek, Bedrock, Together, Vercel, zAI, …).
- `#[tool]` proc-macro: any Rust fn becomes a callable tool with auto JSON Schema (via `schemars`) and inferred name/description from doc-comments.
- Agentic loop with `stop_when(closure)` — accepts `Fn(&LanguageModelOptions) -> bool`, full options access (history, usage, last text, tool calls).
- Helper `step_count_is(n)` for the common case.
- Lifecycle hooks: `on_step_start(&mut options)`, `on_step_finish(&mut options)` — same hook surface AI SDK v5 has.
- Step metadata: `step_id`, `messages()`, `usage()`, `tool_calls()`, `tool_results()` per step.
- **Streaming via `stream_text()`** — wire-compatible with `@ai-sdk/react`'s `useChat`. The Next.js frontend's `useChat` calls a Rust `axum` route returning aisdk's stream **with zero changes**.
- Structured output (JSON Schema → typed Rust struct), embeddings, prompt templates (Tera).
- Capability-typed at compile time (picking a non-tool-calling model + tools = compile error).
- Status: v0.5.2, MIT, active, 218★, 9 contributors. Younger than rig.

#### **rig** (0xPlaygrounds/rig) — mature multi-provider agent framework

- 7.2k★, 208 contributors, **587 releases**, v0.36.0 (5 days old). Most-shipped Rust LLM framework today.
- 20+ model providers, 10+ vector stores (Mongo, Lance, Neo4j, Qdrant, SQLite, Surreal, Milvus, Scylla, S3Vectors, Helix, Cloudflare Vectorize).
- Full GenAI Semantic Convention (OpenTelemetry) compatibility — observability built in.
- Agentic workflows with multi-turn streaming, tool calls, RAG.
- **WASM compatible** (core).
- Production users: **Neon's app.build V2 reboot in Rust**, **VT Code (a Rust terminal coding agent — proof a Claude-Code-style tool ships in Rust today)**, Coral Protocol, ilert, Listen, deepwiki-rs, Cortex Memory, Ironclaw.
- The fact that VT Code already works derisks the bet entirely.

### 1.2 Supporting crates we will need

| Concern | Crate | Notes |
|---|---|---|
| Web server | `axum` 0.8 | Already in operonx |
| Async runtime | `tokio` 1.x | Already in operonx |
| HTTP client | `reqwest` | Used internally by aisdk & rig |
| SSE responses | `axum::response::sse` | Built-in |
| WebSocket | `axum::extract::ws` / `tokio-tungstenite` | For interactive sub-channels |
| Process spawning / PTY | `tokio::process` + `portable-pty` | Real terminal execution for the coding agent |
| File walk | `ignore` | gitignore-aware, used by ripgrep |
| Code search | `grep` family of crates | ripgrep-grade |
| AST search | `ast-grep` (lib) | Same engine as the CLI tool |
| Code parsing | `tree-sitter` + lang grammars | What VT Code uses |
| Patches | `imara-diff`, `similar` | Unified diff + apply |
| Git | `gix` (gitoxide, pure-rust) or `git2` (libgit2) | gix is faster |
| File watching | `notify` | Hot-reload, change detection |
| MCP protocol | `rmcp` (official Rust SDK) | If we want MCP tool servers later |
| Local inference (optional) | `candle`, `mistralrs`, `kalosm` | Offline / private models later |
| RAG (optional) | `rig-sqlite`, `rig-qdrant`, `swiftide` | Code-aware retrieval |
| Telemetry | `tracing` + `opentelemetry` | rig speaks GenAI semconv natively |
| DB | `sqlx` (Postgres) | Already in operonx for runs/run_events |

**Bottom line:** every primitive we need exists, is maintained, and is production-proven. Nothing is missing for a Claude-Code-class agent in Rust.

---

## 2. Why aisdk over rig (for Operon specifically)

| Criterion | aisdk | rig | Winner |
|---|---|---|---|
| Frontend reuse | **`useChat` works as-is** — same wire protocol | Custom format | **aisdk** |
| Maturity | v0.5, 7 months old | v0.36, 2 years, 7k★ | rig |
| Provider count | 73+ | 20+ | aisdk |
| Vector stores | None | 10+ companion crates | rig |
| Observability | Roadmap | Built-in OTel | rig |
| Tool ergonomics | `#[tool]` macro | Builder pattern | aisdk |
| Risk | Smaller community | Battle-tested | rig |

**Recommendation:** **aisdk** as the agent core, **rig** later if/when we add RAG over the user's codebase. They can coexist — pick per feature. The killer reason to prefer aisdk: our existing Next.js `useChat` UI works with zero changes, so we ship the MVP without rebuilding any chat UI.

---

## 3. Desktop future: what Rust unlocks (this is the real reason to build in Rust)

### 3.1 Tauri v2 — the obvious path

- Tauri uses the OS native webview (no Chromium bundled). **Minimum app size ~600 KB** vs Electron's 100+ MB.
- Frontend: our existing Next.js code (static export) — **zero rewrite**.
- **The same `operonx` Rust crate becomes the Tauri main process.** No sidecar, no IPC bridge, no duplicate code paths. The exact code that powers operon.app powers operon-desktop.
- Tauri v2 also ships **iOS + Android** from the same Rust core.
- Plugins available: filesystem, shell, notifications, deep links, system tray, auto-updater, signing, hardened security model with allow-lists.

### 3.2 If we don't build in Rust

- Web stays Next.js + Node. Desktop = Electron (huge binary) or rewrite the agent runtime in Rust later anyway.
- Local file/shell tools require Electron's Node access (perf/security tradeoffs) or a separate Rust sidecar — now you maintain two implementations.

### 3.3 Conclusion

**Building the agent runtime in Rust now is the single biggest leverage move for desktop and mobile.** It's not academic preference — it determines whether desktop ships as a one-week port or a six-month rewrite.

---

## 4. The MVP test: "build a complete repo in one long session"

### 4.1 What "Claude Code / GitHub Copilot UX" actually requires

1. Persistent streaming chat with reasoning, tool calls, tool outputs interleaved.
2. Real file operations — read, write, patch — visible as collapsible diffs.
3. Real shell execution with live stdout/stderr stream and exit code.
4. Plan / todo panel that the agent maintains during the session.
5. Resumability — close laptop, reopen, session continues from last event.
6. Long sessions — hours, hundreds of turns, no context overflow → automatic compaction.
7. Approval surface — for the MVP, **default auto-approve everything** (per directive: no sandbox).
8. Cancel / interrupt mid-turn.

### 4.2 The single MVP user story

**One prompt: "Build a Next.js todo app with Postgres and auth", agent runs for hours, produces a working repo, all visible live in the UI.**

That story drives every architectural decision below.

---

## 5. Architecture

```
┌──────────────────────────────────────────────────────────┐
│ Next.js 16 (existing)                                    │
│  ├─ /dashboard/coding/page.tsx  ←  new: Claude-Code UX   │
│  │     • useChat({ api: "/api/coding" })                 │
│  │     • diff viewer, shell stream, plan panel           │
│  └─ /api/coding (Next route handler)                     │
│        • thin proxy → Rust http://127.0.0.1:8080/agent/* │
│        • forwards SSE bytes verbatim                     │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ operonx (Rust, axum)                                     │
│                                                          │
│  /agent/runs            POST → start run, return run_id  │
│  /agent/runs/:id/sse    GET  → SSE stream (resumable)    │
│  /agent/runs/:id/input  POST → user message mid-session  │
│  /agent/runs/:id/cancel POST → interrupt current turn    │
│                                                          │
│  ┌─── AgentRunner (per active run) ──────────────────┐   │
│  │   aisdk LanguageModelRequest                      │   │
│  │     .stop_when(step_count_is(N) || token_cap)     │   │
│  │     .on_step_finish(persist_to_postgres)          │   │
│  │     .with_tool(read_file, write_file,             │   │
│  │                apply_patch, exec, search,         │   │
│  │                list_dir, plan_*, git_*)           │   │
│  │   broadcast::channel<Event> → SSE subscribers     │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  Persistence:                                            │
│    runs        (id, status, model, workspace_path, ...)  │
│    run_events  (run_id, seq, type, payload jsonb)        │
│    run_messages(run_id, role, parts jsonb)               │
│                                                          │
│  Long-session features:                                  │
│    • Auto-compaction at token threshold                  │
│    • Workspace pinned per run (cwd)                      │
│    • Reconnect = replay events from last_seq + tail live │
│    • No sandbox: tools execute as the operonx process    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Tools (Rust, native)  │
              │  read_file            │
              │  write_file           │
              │  apply_patch          │
              │  exec (PTY-backed)    │
              │  search (ripgrep)     │
              │  list_dir / glob      │
              │  git_* (gix)          │
              │  plan_set / plan_step │
              └───────────────────────┘
```

### 5.1 Why this shape

- **Frontend is unchanged.** Same `useChat` hits a different route. Zero UI rewrite to start.
- **The Rust crate is the runtime.** Same binary becomes the Tauri main process later — no double implementation.
- **Postgres is the source of truth.** Reconnect, multi-tab, "close laptop" all just work via event replay.
- **No sandbox layer.** Per directive. Tools call syscalls directly.
- **SSE not WebSocket** for the MVP — `useChat` already handles SSE, fewer moving parts.

---

## 6. Phased delivery

### Phase 0 — Park current Codex bridge (≈1 hr)
- Move `lib/codex/protocol/` to reference-only.
- Remove `/codex/*` routes from operonx; keep TS types as docs.
- Drop or feature-gate the `codex` Rust module.

### Phase 1 — MVP coding session (the test target)
1. Add `aisdk` to operonx with `openai` + `anthropic` features.
2. New module `operonx::agent`:
   - `AgentRunner` per run, owns the aisdk request.
   - `broadcast::channel<AgentEvent>` per run.
   - `on_step_finish` hook → write events + messages to Postgres.
3. Tools (priority order):
   - `read_file(path) -> String`
   - `list_dir(path) -> Vec<Entry>`
   - `write_file(path, contents) -> ()`
   - `apply_patch(unified_diff) -> Result<Summary>`
   - `exec(command, cwd) -> { stdout, stderr, exit }` (streaming via separate event channel)
   - `search(pattern, glob) -> Vec<Match>` (ripgrep-grade)
4. HTTP routes:
   - `POST /agent/runs` → create run row, spawn runner
   - `GET  /agent/runs/:id/sse` → on connect, replay `run_events` from `?last_seq=`, then tail live broadcast
   - `POST /agent/runs/:id/input` → push new user message into the runner
   - `POST /agent/runs/:id/cancel` → abort the runner future
5. Next.js:
   - Replace `app/dashboard/coding/page.tsx` with a Claude-Code-style chat (composer + message stream + diff/exec viewers).
   - `app/api/coding/route.ts` → proxy to operonx (forward bytes for SSE, headers for auth).
6. **Acceptance:** open `/dashboard/coding`, prompt "build a Next.js todo app with Postgres and auth", agent works ≥30 min, produces a runnable repo in `./workspaces/<run_id>/`.

### Phase 2 — Long-session hardening
- Token-budget auto-compaction (`stop_when` triggers a summarize-and-restart turn).
- Resume after restart (replay events into the UI; restart aisdk request from compacted state).
- Plan/todo tool with persistent plan state per run.
- Live diff panel + live shell tail panel.
- Approval policy toggle (default `auto`, optional `ask`).

### Phase 3 — Multi-vertical reuse
- Move existing `/dashboard/chat` to also use `operonx::agent` (with a different tool set per channel).
- Background jobs / scheduler use the same `AgentRunner`.

### Phase 4 — Desktop / Mobile (Tauri v2)
- New crate `operon-desktop` depends on `operonx` as a library (extract the `axum` router into a public fn).
- Tauri shell loads the same Next.js frontend (static export).
- Auto-updater, system tray, deep links.
- iOS/Android from the same Rust core.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| aisdk is young (v0.5) — possible bugs | Pin version; if a provider breaks, swap to `rig` for that one provider. |
| Streaming wire-format drift between aisdk and `@ai-sdk/react` | Lock both versions; integration test on every PR. |
| Long context blowing up tokens | Auto-compaction at ~80% of context window; checkpoint summary into next turn's system prompt. |
| Shell commands hanging the runner | Timeout + cancellation token per `exec`; kill child on cancel. |
| Postgres event volume on long runs | Batch inserts; partition `run_events` by month after MVP. |
| User closes laptop mid-turn | Runner is a tokio task; keep running on disconnect. Reconnect replays events. |
| Multiple concurrent runs | One `AgentRunner` per `run_id` in a `DashMap<RunId, Handle>`. |

---

## 8. Decision summary

- **Use Rust.** Ecosystem is ready: aisdk + rig + tauri + tokio + sqlx + tree-sitter + ripgrep crates.
- **Use aisdk** as the agent core. Keep the existing `useChat` frontend.
- **Park the Codex bridge.** Keep its TS protocol bindings as a reference for tool shapes only.
- **No sandbox.** Tools run native. Approval auto by default.
- **Postgres for everything stateful.** Resume, replay, multi-tab, multi-device.
- **Tauri v2** is the desktop/mobile path. Same Rust crate, no rewrite.

---

## 9. Open questions for you

1. **Default model:** GPT-5 (OpenAI) or Claude Sonnet 4.5 (Anthropic) as the MVP default?
2. **Workspace location:** `./workspaces/<run_id>/` inside the operonx working dir, or a configurable root?
3. **Multi-user isolation:** for the MVP, OK if all runs share the operonx process user, or per-user OS users from day one?
4. **Auth on `/agent/*`:** reuse the existing operonx auth cookies (recommended) — confirm.
