# Operon Coding Agent Plan

## Decision

Operon will keep its existing web product shell and build a web-first coding agent by cloning/forking OpenAI Codex and modifying it into an Operon-owned Rust agent engine.

This is not a thin permanent wrapper around upstream Codex. The goal is to use Codex as the starting point, keep the useful agent functionality, then gradually rename, remove, reshape, and extend it for Operon's product.

## Product Direction

Operon is broader than a coding tool. The dashboard and product identity should stay because future modules may include ads, Meta account connection, social automation, trading, communication channels, workflows, and business operations.

The first serious product surface is coding:

- professional web chat UX
- long-running coding sessions
- background jobs
- command execution visibility
- file diffs and patch review
- approval flows
- resume and continuation
- repo/workspace context
- agent plans and progress

## Architecture Direction

Preferred long-term shape:

```txt
Operon Web Frontend
  -> operonx Rust API / control plane
  -> Operon Agent Engine
  -> Codex-derived Rust internals
  -> workspace, shell, git, model providers, tools
```

Recommended repo layout:

```txt
operon/
  app/                    Next.js app
  components/             existing Operon UI
  lib/                    existing web/server helpers
  docs/
  operonx/                Rust API/control plane
  engine/
    codex/                cloned/forked Codex source, modified over time
```

Alternative later if the Rust side grows:

```txt
operon/
  apps/web/
  crates/operonx/
  crates/operon-agent/
  vendor/codex/
```

## What To Keep From Codex First

Keep the proven parts before heavy redesign:

- agent loop
- model interaction
- shell command execution
- sandbox and approvals
- file read/write/edit tooling
- patch/diff behavior
- session persistence
- resume/fork semantics if useful
- MCP/plugin/tool concepts
- review mode if practical
- JSON/protocol event stream concepts

## What To Change For Operon

Over time, make the engine fit Operon:

- rename Codex concepts to Operon concepts
- remove or hide upstream product branding
- remove workflows that do not fit the web product
- replace terminal-first UX assumptions with web-first events
- make long sessions durable in Operon's database
- add Operon auth, users, workspaces, projects, and billing boundaries
- add product modules beyond coding after the coding product works
- add business automation tools such as Meta ads later

## Legal Boundary

Codex is Apache-2.0, so cloning/forking/modifying is allowed with required license notices.

Do not copy proprietary internals from Claude Code, GitHub Copilot, or any closed-source local package. Those tools can be used for behavioral inspiration only unless their license explicitly allows source reuse.

## First Milestone

Build a local web coding-agent MVP:

- one local workspace
- one authenticated Operon user
- one active agent session
- start a session from the web UI
- send a coding prompt
- stream assistant text and agent events
- show command execution
- show file changes/diffs
- support interrupt/cancel
- persist run events in the existing `runs` and `run_events` database tables

## Implementation Steps

1. Clone/fork Codex into `engine/codex` or a sibling repo.
2. Keep license files and notices.
3. Identify the Rust crates responsible for agent loop, protocol/events, tools, shell, sandbox, and session persistence.
4. Add an Operon-facing Rust service boundary in `operonx` or a new `operon-agent` crate.
5. Expose web APIs:
   - `GET /codex/healthz`
   - `GET /codex/models`
   - `POST /codex/sessions`
   - `POST /codex/sessions/:id/messages`
   - `GET /codex/sessions/:id/events`
   - `POST /codex/sessions/:id/interrupt`
   - `POST /codex/approvals/:id`
6. Convert Codex/engine events into Operon UI events.
7. Persist raw engine events and normalized UI events.
8. Replace the current coding/chat execution path in the web UI with the Rust engine path.
9. Build professional event renderers:
   - command card
   - file diff panel
   - approval card
   - session status
   - plan/progress checklist
   - changed files sidebar
10. Validate with real coding workflows:
   - read repo
   - edit file
   - run test
   - handle command failure
   - interrupt
   - resume

## What Not To Do Yet

- Do not rewrite the agent from scratch.
- Do not remove the existing Operon dashboard shell.
- Do not build ads/social/trading modules before the coding agent works.
- Do not deeply modify every Codex internal before the first web MVP.
- Do not depend on closed-source Claude/Copilot internals.

## Prompt For Another AI Agent

Use this prompt when assigning another agent to work in this repo:

```text
You are working in the Operon repo at c:\Users\akash\work\operon.

Read PLAN.md and docs/operon-codex-web-architecture.md before making changes.

The product decision is:
Operon will keep its existing web dashboard/frontend and build a web-first coding agent by cloning/forking OpenAI Codex, then gradually modifying Codex into an Operon-owned Rust agent engine. We are not building a custom agent from scratch right now, and we are not replacing Operon's product shell.

Primary goal:
Create the foundation for an Operon web coding-agent experience using a Codex-derived Rust backend. The coding product should support long-running sessions, streaming events, command output, approvals, file diffs, interrupt/cancel, and durable run history.

Important boundaries:
- Keep Operon's existing frontend/design direction.
- Use Codex open-source code only under Apache-2.0 license requirements.
- Do not copy proprietary Claude Code or GitHub Copilot internals.
- Use Copilot/Claude only for behavioral inspiration if needed.
- Prefer Rust for the durable agent runtime and long-running work.
- Keep changes scoped and avoid unrelated redesigns.

Recommended first work:
1. Inspect operonx and the existing runs/run_events schema.
2. Inspect the current Next chat route and streaming hook.
3. Propose or implement the first Rust API boundary for agent sessions/events.
4. If cloning Codex, place it under engine/codex or document the chosen location.
5. Preserve license notices.
6. Build incrementally toward a local web coding-agent MVP.

Do not start by rewriting the whole app. The first target is a small vertical slice: web prompt -> Rust agent runtime -> streamed events -> persisted run events -> UI rendering.
```

