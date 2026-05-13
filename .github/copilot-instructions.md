# Operon — Copilot agent instructions

> Auto-loaded by GitHub Copilot for every chat in this workspace. Future AI agents MUST follow these rules.

## Active product plan (locked 2026-05-13 — DO NOT REORDER without asking the user)

**Priority 1 — UI/UX repair to pre-2026-05-12 quality (in progress).** The chat UI from commits older than yesterday was the user-approved baseline. Reference commits: `f9ce32f` (2026-05-11), `4f11565` (2026-05-07). When fixing message UI, ALWAYS diff against these commits first — do not invent styles. Specifically: drop the noisy progress chain ("Evaluating request / Sending request to model / Received model response") emitted from `server/src/agent/runner.rs`, keep only one "Working…" indicator, move usage out of the message body into the status bar, keep the centered greeting + chip empty state and the right-aligned bubble `UserMessage`.

**Priority 2 — Continue Rust backend.** Lots of work invested, fast, working. Finish remaining ~3% Copilot parity (live compaction stream, child-run streaming, isolated subagent budgets, provider request id, inline error cards). Investigate adopting an existing Rust agent SDK (e.g. `rig`, `swiftide`) for agents/subagents instead of hand-rolled before any major refactor.

**Priority 3 — `ads-manager` branch.** Separate sub-product for SEO + Meta Ads + Google Ads ONLY. New landing page with images + heavy social proof, "intentional vibe-coded" look. Goal: SEO + ads revenue. Shares auth/billing/MongoDB with main; different sidebar, agent prompt, integrations, domain. Do NOT pollute `main` with ads-only code.

**Priority 4 — `main` branch keeps growing as unified Operon AI.** Chat, Google, Social, Trading, Coding today; future code editor, trading agent, desktop app.

**Future experiments (NOT now, only when explicitly approved).** Vercel AI SDK v6 `ToolLoopAgent` + native subagents + Workflow SDK (`'use workflow'`/`'use step'` durable steps with managed persistence + observability) + AI Gateway + Vercel Agent — would replace hand-rolled tool loop, durable runs, provider routing. Spike branch only when greenlit. Express alternative considered.

## Branch awareness

- ALWAYS run `git branch --show-current` before non-trivial edits.
- `main` → unified Operon AI, all features.
- `ads-manager` → ads-only sub-product.
- `spike/*` → throwaway experiments.

## Brand

Name not finalized. Candidates: keep "Operon" or family pattern like Eaztack → Eazcode/Eazads. Treat the brand string as a single config constant for easy swap. Desktop app is planned — name must scale.

## Git hygiene

- `server/` IS tracked in the parent repo (no nested `.git`). Root `.gitignore` MUST exclude: `server/.git/`, `server/target/`, `server/.sqlx/`, `**/node_modules/`, `**/.next/`, `*.log`, local `.env*`.
- If `git status` shows >1000 files, an ignore pattern regressed.

## Stack

- **Next.js 16.2.4** (Turbopack) App Router, **React 19.2.4**. This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before introducing new APIs.
- **Vercel AI SDK v6** (`ai@6`, `@ai-sdk/react@3`). Use `streamText` + `result.toUIMessageStreamResponse({ sendReasoning: true, sendSources: true })`. Client uses `useChat` + `DefaultChatTransport`.
- **Chat SDK** (`chat`, `@chat-adapter/state-memory`, `chat-adapter-baileys`). Reference docs in `chat-sdk-docs/`. `thread.post()` accepts AI SDK `fullStream`. Use `toAiMessages()` to convert chat → AI SDK input.
- **next-auth v5 beta** with `@auth/mongodb-adapter`. Google + Credentials, JWT sessions, custom `/login`. OAuth must use the `signIn()` client helper.
- **MongoDB 7.2**. Default DB `"operon"` (override via `MONGODB_DB`). Mongo client singleton in `lib/db.ts`; typed collection getters in `lib/db-collections.ts`.
- **Tailwind v4** + shadcn/ui + Radix + Lucide. Spacing token = 4px / unit. v4 mask classes are `mask-[…]`, `mask-intersect`, `bg-linear-to-l`.
- **pnpm**, Windows host.

## App Router conventions

- Server components by default. Add `"use client"` only when you need state, effects, or browser APIs.
- **Never** pass component refs (e.g. lucide icons) through RSC props into a client component — render them inside a server component, or import the icon directly inside the client component.
- Page-level redirects: `import { redirect } from "next/navigation"; redirect("/path");` from a server component.

## File / folder layout

Keep files small and focused. Split aggressively.

```
app/
  api/                 route handlers (POST/GET/etc.)
  dashboard/           dashboard shell + nested routes
    settings/
      layout.tsx       Brilion-style tabs + Admin row
      providers|workspace|persona/page.tsx
components/
  dashboard/           shell, sections config, settings tabs
  chat/
    chat-view.tsx
    conversation-list.tsx
    composer/
    message/
      message.tsx
      parts/
        text-part.tsx
        reasoning-part.tsx
        tool-part.tsx
        file-part.tsx
        source-url-part.tsx
        tools/<tool>.tsx
lib/
  db.ts                Mongo singleton
  db-collections.ts    typed collection getters
  services/            agents, skills, integrations, scheduler, sessions, logs, uploads
  ai/
    provider.ts        model + provider config
    system-prompt.ts
    convert.ts         AI SDK ⇄ chat SDK helpers
    tools/<tool>.ts    one file per tool
  bot/                 chat SDK plumbing (split by adapter)
```

## Sidebar / navigation

- Main sidebar = **5 items** (Chat, Google, Social, Trading, Coding) + Settings at the bottom. **No "Operate" group.**
- Admin pages (Overview, Agents, Skills, Integrations, Scheduler, Sessions, Logs) live under `adminDashboardSections` and are surfaced as a row inside the Settings layout.
- Settings = horizontal tabs **Providers / Workspace / Persona** (`settingsTabs` in `components/dashboard/dashboard-sections.tsx`).
- Sidebar widths: `w-57` expanded, `w-20` collapsed. Do not change without explicit request.
- Dashboard index redirects to `/dashboard/chat`.

## AI streaming UI rules

- Use `streamText` server-side, return `toUIMessageStreamResponse({ sendReasoning: true, sendSources: true })`.
- Always include `stopWhen: stepCountIs(8)` for tool-calling agents.
- Persist the FULL `UIMessage.parts` array in `onFinish` — text, reasoning, tool-*, file, source-url. Never persist only `[{type:"text",text}]`.
- Reasoning UI: render **inline** as italic + muted with a thin left border, plus a live caret while `state === "streaming"`. **Do NOT** wrap reasoning in a collapsed "thinking" bubble.
- Tool UI: respect lifecycle states `input-streaming` → `input-available` → `output-available` / `output-error`. Dispatch to per-tool components under `components/chat/message/parts/tools/<tool>.tsx`.

## Persistence

- Everything goes through MongoDB. No in-memory state for production code paths.
- Each route handler that mutates state must write an audit entry to the `logs` collection (especially tool calls and channel sends).

## Tooling gotchas

- `apply_patch` is **disabled** in this workspace. Use `replace_string_in_file`, `multi_replace_string_in_file`, and `create_file` for all edits.
- Windows + Next dev server: deleted files may be locked; if `create_file` reports "already exists" or appends instead of overwriting, truncate via `(Get-Content path -TotalCount N) | Set-Content path -Encoding UTF8`.
- PowerShell wildcard brackets bite: paths like `app/vendor/[slug]/page.tsx` need `-LiteralPath` in `Test-Path`/`Remove-Item`/`Get-Content`. Prefer `read_file` / `list_dir` tools.
- After multi-file edits, ALWAYS run `get_errors` on the touched files. It does not catch duplicate-export issues — verify via `read_file` if you suspect a bad overwrite.
- No emojis in UI strings or chat output unless the user explicitly asks. Audit with `grep_search` regex `vendor\.emoji|emoji: "`.

## Brand / UI

- Wordmarks: prefer premium path-only SVG over PNG or font text in the navbar. Tight icon-to-wordmark spacing — no visible gap between fingerprint mark and wordmark.

## Validation checklist before claiming done

1. `get_errors` on every touched file.
2. `pnpm lint`
3. `pnpm exec tsc --noEmit --pretty false --incremental false`
4. `pnpm build`
5. Browser smoke check on the changed routes.
