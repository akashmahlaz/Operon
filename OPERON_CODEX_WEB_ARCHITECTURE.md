# Operon Codex Web Architecture

## Goal

Keep Codex functionality intact while replacing the terminal-first chat experience with Operon's web frontend. Codex should remain the coding engine. Operon should become the web control plane for sessions, provider setup, approvals, diffs, commands, long-running work, and future business automation modules.

## Direction

The right first architecture is protocol-compatible frontend replacement, then a controlled internal fork once the web coding product proves the workflow. This is not a from-scratch rewrite.

- Run Codex through `codex app-server` first.
- Connect a Rust bridge service to the app-server over stdio or websocket.
- Expose Operon-friendly HTTP/SSE/WebSocket APIs from the Rust bridge.
- Render Codex protocol events in the existing Next.js dashboard UI.
- Persist threads, turns, runs, and event logs in Operon's database for long-session continuity.
- After parity, vendor or fork Codex into an Operon-owned engine and gradually replace upstream-facing names, config, and UX assumptions.

Deep Codex modifications are part of the ownership strategy, but the first milestone should preserve upstream behavior by treating Codex app-server as the source of truth. The bridge is not wasted work: it becomes the compatibility harness and lets Operon test the fork against the official protocol as the engine changes.

## Fork Strategy

The product goal is ownership, not a permanent wrapper. The safest path is staged:

1. Use upstream Codex app-server as the local engine while building the Operon web UI.
2. Preserve every important protocol event and request in Operon's Rust bridge and event log.
3. Build the coding page against Operon APIs, not directly against upstream Codex internals.
4. Once the web workflow covers start/resume/turns/commands/diffs/approvals/interrupt, create an internal Codex fork under `engine/codex` or `vendor/codex`.
5. Rename and adapt gradually: Codex app-server becomes Operon agent server, Codex thread maps to Operon run/thread, Codex sessions become Operon coding sessions.
6. Keep the agent loop, sandboxing, approvals, tools, resume/fork, MCP, plugins, and model/provider logic intact until Operon has tests proving equivalent behavior.

Recommended near-term layout:

```txt
operon/
	app/                  Next.js web frontend
	components/
	lib/
	operonx/              Rust API/control plane
	engine/codex/         later: internal Apache-2.0 Codex fork
```

Recommended later layout if the repo becomes a larger monorepo:

```txt
operon/
	apps/web/
	crates/operonx/
	crates/operon-agent/
	vendor/codex/
```

## Local Findings

- `@openai/codex@0.128.0` is installed globally.
- `codex app-server` exists and supports `stdio://`, `unix://`, and `ws://IP:PORT` transports.
- `codex app-server generate-ts --out <DIR> --experimental` can generate TypeScript protocol bindings for the frontend.
- `@github/copilot@0.0.411` is installed globally.
- Copilot CLI exposes useful product ideas: interactive mode, plan mode, autopilot mode, shell mode, session resume, background agent tasks, LSP support, MCP configuration, allow/deny tools, allow/deny URLs, and session sharing.
- Claude Code is not currently available on PATH or as global `@anthropic-ai/claude-code`, so its local internals could not be inspected yet.

## Important Legal Boundary

Codex is Apache-2.0, so forking/modifying is viable with notices. The local GitHub Copilot CLI package is licensed under its own `LICENSE.md`; use it for behavioral inspiration and public API understanding, not source copying unless its license explicitly allows the intended use.

## Core Components

### 1. Codex Runtime

Codex remains responsible for:

- model interaction
- tool planning
- file reads and writes
- command execution
- sandbox and approval logic
- MCP/apps/plugins/skills
- review mode
- resume/fork/thread history semantics
- provider profiles and model selection

### 2. Rust Bridge

`operonx` should grow a coding runtime module or a sibling crate such as `operon-codex-bridge`.

Responsibilities:

- spawn or connect to `codex app-server`
- send JSON-RPC requests: `initialize`, `thread/start`, `thread/resume`, `turn/start`, `turn/steer`, `turn/interrupt`, `review/start`, `model/list`, `config/read`, `skills/list`, `mcpServer/*`
- receive Codex notifications and approval requests
- convert Codex events into Operon stream events
- persist raw Codex events to `run_events`
- map authenticated Operon users to sessions/workspaces
- enforce workspace ownership and path permissions before forwarding actions

### 3. Web Frontend

The existing dashboard should stay. The Coding page becomes a professional Codex client.

Minimum views:

- workspace/repo picker
- thread list with resume/fork
- main chat timeline
- composer with attachments, model, mode, sandbox, and approval controls
- streaming assistant output
- command output panel
- file diff/patch panel
- approval prompts
- session status and interrupt/continue controls

### 4. Persistence

Operon should persist:

- Codex thread id
- Operon conversation id
- workspace path/repo metadata
- selected model/provider/profile
- sandbox mode and approval policy
- run status
- full raw protocol events
- normalized UI events for fast replay

The existing `runs` and `run_events` tables are already a good base.

## All-Functionality Checklist

To claim parity with Codex, the web UI must support:

- start/resume/fork/list/read threads
- start/steer/interrupt turns
- streaming assistant messages
- reasoning events if provided
- command execution output deltas
- file changes and patch previews
- apply/reject approval prompts
- model list and selected model
- account login/read/logout flows
- config read/write where appropriate
- sandbox mode selection
- permission profile selection
- MCP server listing and actions
- skills/apps/plugins listing and invocation
- review mode
- cloud task browsing/apply later
- raw event replay for long sessions

## Inspired Product Additions

After parity, Operon should improve the coding product with:

- Plan mode: agent produces a structured plan and waits for approval.
- Autopilot mode: agent keeps working through multiple turns until blocked or complete.
- Shell mode: command-focused assistant with strong approvals.
- Long-session dashboard: show active tasks, checkpoints, elapsed time, files touched, commands run, and next action.
- Background coding jobs: allow a task to run while user moves to Google/Social/Trading modules.
- Workspace memory: repo facts, project rules, failures, fixes, and successful commands.
- LSP-aware code intelligence: diagnostics and symbol context before asking the model.

## Implementation Order

1. Generate Codex TypeScript protocol bindings:

```powershell
codex app-server generate-ts --experimental --out lib/codex/protocol
```

2. Add Rust bridge module in `operonx`:

- `src/codex/mod.rs`
- `src/codex/session.rs`
- `src/codex/json_rpc.rs`
- `src/codex/events.rs`
- `src/http/codex.rs`

3. Add API endpoints:

- `GET /codex/healthz`
- `GET /codex/models`
- `POST /codex/threads`
- `POST /codex/threads/:id/turns`
- `POST /codex/turns/:id/interrupt`
- `GET /codex/threads/:id/events` via SSE
- `POST /codex/approvals/:id`

4. Replace the Coding page body with a Codex web client while keeping the existing dashboard shell and design language.

5. Add event renderers in small components:

- `components/codex/codex-chat.tsx`
- `components/codex/codex-composer.tsx`
- `components/codex/codex-command-output.tsx`
- `components/codex/codex-file-diff.tsx`
- `components/codex/codex-approval-card.tsx`
- `components/codex/codex-session-sidebar.tsx`

6. Validate parity against Codex TUI workflows: simple prompt, file edit, command run, approval, interrupt, resume, fork, review.

## Recommended First Build Milestone

Build a local web Codex client first:

- one local workspace
- one active Codex app-server process
- one authenticated Operon user
- thread start/resume
- turn start
- streaming text
- command output
- file patch preview
- interrupt

This gives the product a real coding surface quickly, while leaving providers, cloud, ads, social, and trading as separate modules in the same Operon shell.
