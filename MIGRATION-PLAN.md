# Operon: Full Rust Migration + Reliability Plan

> **Goal**: Next.js = pure UI/UX. Zero API routes, zero database access in Next.js. All logic in Rust.
> **Additional**: Deep logging, multi-provider reliability, session management, VS Code-quality streaming.

---

## Current Architecture Assessment

### What's ALREADY in Rust (~80%)
- ✅ Auth (signup, login, OAuth Google/GitHub, JWT)
- ✅ Agent runner (LLM loop, tool execution for coding tools)
- ✅ Conversations CRUD + messages
- ✅ Provider profiles CRUD + model fetching
- ✅ Uploads (S3 + local fallback)
- ✅ Admin (usage, logs, agents)
- ✅ Integrations status (WhatsApp/Telegram/GitHub)
- ✅ Native coding tools (read/write/exec/search/patch/github)
- ✅ SSE streaming to frontend

### What STILL lives in Next.js (~20%)
- ❌ `app/api/tools/execute/route.ts` — Rust calls this for 20 integration tools
- ❌ `app/api/tools/route.ts` — Tool listing/registry
- ❌ `app/api/agent-skills/route.ts` — Skills listing
- ❌ `app/api/social/meta/*` (8 routes) — Full Meta Ads API
- ❌ `lib/services/*.ts` (11 files) — DB queries for tools
- ❌ `lib/ai/tools/*.ts` (20 tools) — Integration tool execution
- ❌ `lib/memory.ts` — Semantic memory + pgvector
- ❌ `lib/pg.ts` — Postgres connection from Next.js

---

## Critical Bugs Found (Fix FIRST)

### Bug 1: MiniMax stops after one line
**Root causes:**
1. **No `max_tokens` sent** — MiniMax defaults to ~256-512 tokens. Response truncates silently.
2. **`stream_options: { "include_usage": true }`** — Non-standard OpenAI extension, some providers reject/ignore/break.
3. **No `[DONE]` detection fallback** — If provider closes connection without `[DONE]`, runner treats partial text as complete response without error.

**Fix:** Send `max_tokens` for all providers. Strip `stream_options` for non-OpenAI. Detect stream-end-without-DONE as anomaly.

### Bug 2: UI shows loading for tools/subagents after AI finishes
**Root causes:**
1. **`tool-call-start` emitted during streaming, but no `tool-call-end` if runner fails** — stream error → `anyhow::bail!()` → no cleanup for started tool cards.
2. **`finish_reason == "stop"` with tool calls = orphaned tool UI** — Line 662: `if final_tool_calls.is_empty() || finish_reason == "stop"` → if model sends stop WITH tool calls, tools are shown but never executed.
3. **No abort/cleanup event** — Cancelled runs don't finalize tool card states.

**Fix:** Emit `tool-call-output-error` for all started-but-unfinished tool calls on any error/cancel path. Remove the `|| finish_reason == "stop"` condition.

### Bug 3: Compaction burns expensive credits
**Root cause:** `resolve_summarisation_provider()` uses the conversation's last model (could be Claude Opus at $15/M tokens) for a trivial summarization task. No cost check, no user confirmation.

**Fix:** Default to heuristic-only compaction (zero cost). Optionally use a cheap model (gpt-4o-mini) only if explicitly requested.

### Bug 4: Retry loop is structurally broken
`step_connection_retries` resets every loop iteration because `continue` advances the outer `for` loop. Each retry burns a step from the budget.

**Fix:** Use an inner loop for retries, don't advance the step counter on transient failures.

---

## Phase 0: Critical Bug Fixes + Deep Logging (DO FIRST)

### 0A: Deep Logging Infrastructure

**Rust side — structured tracing with context:**
```rust
// Every LLM request:
tracing::info!(
    run_id = %run_id,
    step = step,
    provider = %provider,
    model = %model,
    input_tokens_estimate = estimated,
    "llm_request_start"
);

// Every SSE chunk:
tracing::trace!(
    run_id = %run_id,
    event_type = %event_type,
    chunk_bytes = bytes.len(),
    "sse_chunk_received"
);

// Every stream termination:
tracing::info!(
    run_id = %run_id,
    finish_reason = %finish_reason,
    total_text_chars = text.len(),
    tool_calls_count = tool_calls.len(),
    stream_had_done = had_done_signal,
    "llm_stream_ended"
);

// Every tool execution:
tracing::info!(
    run_id = %run_id,
    tool = %tool_name,
    duration_ms = elapsed.as_millis(),
    success = result.is_ok(),
    "tool_executed"
);
```

**Frontend side — dev console logging:**
```typescript
// In useStreamEvents:
console.debug(`[stream] ${ev.type}`, {
  toolCallId: ev.data.toolCallId,
  text: ev.data.text?.slice(0, 50),
  timestamp: Date.now(),
});
```

### 0B: Fix MiniMax / Multi-Provider Streaming

1. Add `max_tokens` to all provider requests (configurable per-provider, default 8192)
2. Only send `stream_options` for actual OpenAI API (not OpenRouter/MiniMax/etc.)
3. Detect stream-end-without-DONE → log warning + treat as complete (not error)
4. Detect `finish_reason: "length"` → emit warning event to UI

### 0C: Fix Tool Card Stuck Loading

1. On stream error/cancel, emit `tool-call-output-error` for all `tool_call_started` entries
2. Change line 662 from `|| finish_reason == "stop"` to just `if final_tool_calls.is_empty()`
3. Add timeout for individual tool execution (30s default, configurable)

### 0D: Fix Compaction

1. Change `compact_conversation` to use heuristic-only by default (zero LLM cost)
2. Add optional `mode` query param: `?mode=llm` to opt into LLM summarization with cheap model
3. If LLM mode: always use gpt-4o-mini, never the conversation's active model

### 0E: Fix Retry Loop

Move retry logic into an inner loop so step counter doesn't advance on retries.

---

## Phase 1: Context Window Management (VS Code / ChatGPT Pattern)

### Token Counting Before Send
```rust
struct ContextWindow {
    model_limit: usize,      // e.g., 128_000 for gpt-4o
    output_reserve: usize,   // 4096-8192
    system_reserve: usize,   // actual system prompt tokens
    tool_reserve: usize,     // tool definitions tokens
}

impl ContextWindow {
    fn build_messages(&self, history: &[StoredMessage]) -> Vec<ChatMessage> {
        let budget = self.model_limit - self.output_reserve - self.system_reserve - self.tool_reserve;
        let mut selected = VecDeque::new();
        let mut used = 0;
        
        for msg in history.iter().rev() {
            let cost = estimate_tokens(&msg.content);
            if used + cost > budget { break; }
            selected.push_front(msg.clone());
            used += cost;
        }
        
        // If we dropped messages, prepend heuristic summary
        if selected.len() < history.len() {
            let dropped = &history[..history.len() - selected.len()];
            let summary = heuristic_summary(dropped);
            selected.push_front(summary_message(summary));
        }
        
        selected.into()
    }
}
```

### Model Limits Registry
```rust
fn model_context_limit(provider: &str, model: &str) -> usize {
    match (provider, model) {
        ("openai", m) if m.contains("gpt-4o") => 128_000,
        ("openai", m) if m.contains("gpt-4o-mini") => 128_000,
        ("openai", m) if m.contains("o1") => 200_000,
        ("anthropic", m) if m.contains("claude-3") => 200_000,
        ("anthropic", _) => 200_000,
        ("google", m) if m.contains("gemini-2") => 1_000_000,
        ("openrouter", _) => 128_000, // conservative default
        ("groq", _) => 32_000,
        ("minimax", _) => 128_000,
        ("deepseek", _) => 128_000,
        _ => 32_000, // safe fallback
    }
}

fn default_max_output_tokens(provider: &str, model: &str) -> usize {
    match (provider, model) {
        ("anthropic", _) => 8192,
        ("openai", m) if m.contains("o1") || m.contains("o3") => 16_384,
        ("openai", _) => 16_384,
        ("minimax", _) => 8192,
        ("groq", _) => 8192,
        _ => 4096,
    }
}
```

---

## Phase 2: Port Integration Tools to Rust

### Architecture
```
server/src/
  tools/
    mod.rs              ← dispatch + registry
    context.rs          ← ToolContext (credentials, http client, user_id)
    credentials.rs      ← resolve encrypted API keys from auth_profiles
    memory.rs           ← memory CRUD + pgvector search
    agent_skills.rs     ← procedural skill recipes
    workspace_files.rs  ← BOOTSTRAP.md/SOUL.md/USER.md
    confirm.rs          ← two-phase confirmation
    github.rs           ← extend existing (add token save, PRs, etc.)
    google.rs           ← Gmail + Calendar + SEO (shared OAuth token)
    meta.rs             ← Meta Ads (campaigns, insights, ad accounts)
    vercel.rs           ← Vercel deployments + env vars
    cloudflare.rs       ← DNS, Workers, R2
    stripe.rs           ← products, prices, checkout
    linear.rs           ← GraphQL issues/projects
    slack.rs            ← channels, messages, search
    notion.rs           ← pages, databases, blocks
    resend.rs           ← transactional email
    twilio.rs           ← SMS
    discord.rs          ← bot messages, channels
```

### Each Tool Module Pattern
```rust
use serde_json::{Value, json};
use crate::tools::context::ToolContext;

/// Tool definitions for the LLM (OpenAI function-calling format)
pub fn definitions() -> Vec<Value> {
    vec![
        tool_def("gmail_search", "Search Gmail messages", json!({
            "type": "object",
            "required": ["query"],
            "properties": {
                "query": { "type": "string", "description": "Gmail search query" }
            }
        })),
        // ... more tools
    ]
}

/// Execute a tool by name
pub async fn execute(ctx: &ToolContext, name: &str, args: &Value) -> Result<Value> {
    match name {
        "gmail_search" => gmail_search(ctx, args).await,
        "gmail_send" => gmail_send(ctx, args).await,
        _ => bail!("unknown google tool: {name}"),
    }
}

async fn gmail_search(ctx: &ToolContext, args: &Value) -> Result<Value> {
    let token = ctx.resolve_credential("google").await?;
    let query = args["query"].as_str().context("query required")?;
    
    let resp = ctx.http.get("https://gmail.googleapis.com/gmail/v1/users/me/messages")
        .bearer_auth(&token)
        .query(&[("q", query), ("maxResults", "10")])
        .send().await?;
    
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!(provider = "google", status = %status, "gmail_search failed");
        bail!("Gmail API {status}: {body}");
    }
    
    Ok(resp.json().await?)
}
```

### Migration Order (by dependency + usage)
1. **credentials.rs** — Foundation: decrypt auth_profiles tokens
2. **memory.rs** — Most complex, critical for agent quality
3. **agent_skills.rs** — Simple Postgres CRUD
4. **workspace_files.rs** — Simple Postgres CRUD
5. **confirm.rs** — Already partially exists
6. **github.rs** — Already 70% done in agent::github
7. **google.rs** — Gmail + Calendar + SEO (high usage)
8. **meta.rs** — Full Meta Ads API
9. **vercel.rs** — Simple REST proxy
10. **cloudflare.rs** — Simple REST proxy
11. **stripe.rs** — Simple REST proxy
12. **linear.rs** — GraphQL
13. **slack.rs** — Simple REST
14. **notion.rs** — REST with complex payloads
15. **resend.rs** — Trivial
16. **twilio.rs** — Trivial
17. **discord.rs** — Simple REST

### Transition Strategy (incremental, zero downtime)
```rust
// In the runner, try Rust-native tools first, fall back to Next.js bridge:
async fn dispatch_tool(ctx: &ToolContext, name: &str, args: &Value) -> Result<Value> {
    // Check if tool is implemented natively in Rust
    if let Some(result) = tools::try_dispatch_native(ctx, name, args).await? {
        return Ok(result);
    }
    
    // Fall back to Next.js bridge (removed once all tools are ported)
    tracing::warn!(tool = %name, "falling back to Next.js tool bridge");
    tools::bridge::execute_via_nextjs(ctx, name, args).await
}
```

---

## Phase 3: Port Meta Ads API Routes

Move `app/api/social/meta/*` (8 routes) to `server/src/http/meta.rs`:
- `GET /meta/status`
- `GET /meta/ad-accounts`
- `GET /meta/campaigns`
- `GET /meta/insights`
- `POST /meta/campaign-action`
- `POST /meta/connect`
- `GET /meta/oauth/start`
- `GET /meta/oauth/callback`

---

## Phase 4: Cleanup Next.js

### Delete
- `app/api/` (entire directory)
- `lib/pg.ts`
- `lib/services/*.ts` (all 11 files)
- `lib/ai/tools/*.ts` (all 20 tool files)
- `lib/ai/tools/registry.ts`
- `lib/memory.ts`
- `lib/server-operon-api.ts`
- `lib/db.ts` + `lib/db-collections.ts` (stubs)
- `lib/ai/mcp-client.ts`
- `lib/ai/embeddings.ts`
- `lib/ai/coding-prompt.ts`
- `lib/ai/convert.ts`
- `lib/ai/memory-extractor.ts`
- `lib/ai/system-prompt.ts`

### Keep (frontend-only)
- `lib/operon-api.ts` — Client-side fetch wrapper
- `lib/utils.ts` — UI utilities
- `lib/types.ts` — TypeScript types
- `lib/nav.ts` — Navigation helpers
- `lib/skills.ts` — Built-in skills metadata (UI display only)
- `lib/integrations.ts` — Integration metadata (UI display only)

### Remove from package.json
- `postgres`
- `ai` / `@ai-sdk/react` / `@ai-sdk/openai` / `@ai-sdk/anthropic`
- Any other server-only deps

---

## Phase 5: Advanced Features (Post-Migration)

### 5A: Repo Indexing (Greptile-style)
```rust
// AST-aware chunking + pgvector embeddings
struct CodeChunk {
    file_path: String,
    start_line: u32,
    end_line: u32,
    content: String,
    symbols: Vec<String>,
    language: String,
}

// Hybrid retrieval: vector similarity + keyword BM25
async fn retrieve_context(query: &str, budget: usize) -> Vec<CodeChunk> {
    let embedding = embed_text(query).await?;
    let vector_hits = pgvector_search(&embedding, 50).await?;
    let keyword_hits = keyword_search(query, 30).await?;
    let merged = merge_and_rerank(vector_hits, keyword_hits);
    fit_to_token_budget(merged, budget)
}
```

### 5B: Provider Abstraction Layer
```rust
#[async_trait]
trait LlmProvider: Send + Sync {
    fn name(&self) -> &str;
    fn supports_tools(&self, model: &str) -> bool;
    fn max_context(&self, model: &str) -> usize;
    fn default_max_output(&self, model: &str) -> usize;
    fn requires_max_tokens(&self) -> bool;
    fn supports_stream_options(&self) -> bool;
    
    async fn stream(
        &self,
        request: &NormalizedRequest,
        cancel: CancellationToken,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<NormalizedEvent>>>>>;
}
```

### 5C: Pre-flight Quota Check
```rust
async fn check_quota_before_send(user_id: Uuid, provider: &str) -> Result<()> {
    // Check if provider key is valid
    // Check rate limit headers from last response
    // Estimate cost and warn if high
    // Return Err if definitely over quota
}
```

---

## Implementation Priority

| # | Task | Effort | Impact |
|---|------|--------|--------|
| 0A | Deep logging in Rust runner | 2h | Debug all issues |
| 0B | Fix MiniMax streaming (max_tokens + stream_options) | 3h | Unblocks all OpenAI-compat providers |
| 0C | Fix tool card stuck loading | 2h | Major UX fix |
| 0D | Fix compaction credit burn | 1h | Prevents money loss |
| 0E | Fix retry loop | 1h | Correctness |
| 1 | Context window management | 1d | Handles long sessions |
| 2.1 | credentials.rs | 3h | Foundation for tools |
| 2.2 | memory.rs | 1d | Critical for agent |
| 2.3-5 | Internal tools (skills, workspace, confirm) | 1d | Quick wins |
| 2.6 | github.rs (extend) | 4h | Already mostly done |
| 2.7 | google.rs (Gmail+Calendar+SEO) | 1d | High usage |
| 2.8-17 | Remaining tools | 1 week | Incremental |
| 3 | Meta Ads routes | 1d | Separate concern |
| 4 | Cleanup Next.js | 3h | Final step |

**Total: ~3-4 weeks**, shipping incrementally after each tool.
