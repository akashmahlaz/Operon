"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { describeTool } from "@/components/chat/message/parts/tool-part";
import type {
  StreamingMessage,
  StreamPart,
  ReasoningPartEvent,
  ToolCallEvent,
  TextDeltaEvent,
  SourceUrlEvent,
  ProgressEvent,
  AnchorEvent,
  ReferenceEvent,
  CodeblockUriEvent,
  TextEditEvent,
  ConfirmationEvent,
  CommandButtonEvent,
  WarningEvent,
  UsageEvent,
} from "@/hooks/use-stream-events/types";
import { TOOL_STATE_LABELS } from "@/hooks/use-stream-events/types";
import {
  AlertCircle,
  AlertTriangle,
  Brain,
  Check,
  Copy,
  ExternalLink,
  FileCode2,
  FolderOpen,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Globe,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Mic,
  PencilLine,
  Search,
  Sparkles,
  Terminal,
  Workflow,
  ChevronRight,
  FileText,
} from "lucide-react";

const TOOL_ICONS: Record<string, typeof FileText> = {
  read_file: FileText,
  workspace_file_read: FileText,
  list_dir: FolderOpen,
  workspace_list: FolderOpen,
  search: Search,
  grep_search: Search,
  workspace_grep: Search,
  exec: Terminal,
  run_command: Terminal,
  apply_patch: PencilLine,
  write_file: PencilLine,
  workspace_file_write: PencilLine,
  tavily_search: Globe,
  web_search: Globe,
  web_request: Globe,
  memory_search: Sparkles,
  memory_remember: Sparkles,
  memory_forget: Sparkles,
  spawn_subagent: Workflow,
  discover_skills: Workflow,
  generate_image: ImageIcon,
  generate_video: ImageIcon,
  text_to_speech: Mic,
  github_get_status: GitBranch,
  github_list_repos: GitBranch,
  github_get_repo: GitBranch,
  github_list_contents: FolderOpen,
  github_read_file: FileText,
  github_write_file: PencilLine,
  github_search_code: Search,
  github_list_branches: GitBranch,
  github_create_branch: GitBranch,
  github_list_issues: MessageSquareText,
  github_create_issue: MessageSquareText,
  github_list_prs: GitPullRequest,
  github_list_pull_requests: GitPullRequest,
  github_create_pr: GitPullRequest,
  github_merge_pr: GitMerge,
  github_push_files: PencilLine,
  github_save_token: GitBranch,
};

// ---------------------------------------------------------------------------
// Elapsed timer — tracks how long the reasoning block has been open
// ---------------------------------------------------------------------------
function useElapsedTimer(isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      // Reset via deferred callback to avoid cascading renders
      const timeout = setTimeout(() => setElapsed(0), 0);
      return () => clearTimeout(timeout);
    }
    startRef.current = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      500
    );
    return () => clearInterval(id);
  }, [isActive]);

  return elapsed;
}

// ---------------------------------------------------------------------------
// StreamingDots — the three bouncing dots shown while waiting
// ---------------------------------------------------------------------------
function StreamingDots({ label = "Generating…" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// ToolIcon — picks an icon based on tool name + state
// ---------------------------------------------------------------------------
function ToolIcon({
  toolName,
  state,
}: {
  toolName: string;
  state: ToolCallEvent["state"];
}) {
  const pending = ["calling", "input-streaming", "input-available", "executing"].includes(
    state
  );
  const error = state === "output-error";
  const cls = error
    ? "size-3.5 text-destructive shrink-0"
    : pending
      ? "size-3.5 animate-spin text-muted-foreground/70 shrink-0"
      : "size-3.5 text-muted-foreground/70 shrink-0";

  if (error) return <AlertCircle className={cls} />;
  if (pending) return <Loader2 className={cls} />;
  const Icon = TOOL_ICONS[toolName] ?? Check;
  return <Icon className={cls} />;
}

// ---------------------------------------------------------------------------
// ToolCallItem — Copilot-style: invocationMessage during, pastTenseMessage after,
// collapsible to reveal args + result.
// ---------------------------------------------------------------------------
function ToolCallItem({ event, onRetry }: { event: ToolCallEvent; onRetry?: (ev: ToolCallEvent) => void }) {
  const [open, setOpen] = useState(false);
  const isPending = ["calling", "input-streaming", "input-available", "executing"].includes(
    event.state
  );
  const isError = event.state === "output-error";
  const isDone = !isPending && !isError;

  // Prefer Copilot-style messages when present, otherwise fall back to the
  // raw tool name + an extracted detail.
  const fallbackMsg = describeTool(event.toolName, event.args);
  const invocationMessage = event.invocationMessage?.includes(event.toolName)
    ? undefined
    : event.invocationMessage;
  const pastTenseMessage = event.pastTenseMessage?.includes(event.toolName)
    ? undefined
    : event.pastTenseMessage;
  const msg = isPending
    ? invocationMessage ?? fallbackMsg
    : (pastTenseMessage ?? invocationMessage ?? fallbackMsg);

  // Extract a short mono "target" (path / repo / query / cmd) for the inline subtitle
  const a = (event.args ?? {}) as Record<string, unknown>;
  const pickStr = (...keys: string[]) => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === "string" && v.length) return v;
    }
    return undefined;
  };
  const repo =
    typeof a.owner === "string" && typeof a.repo === "string"
      ? `${a.owner}/${a.repo}`
      : undefined;
  const target =
    pickStr("path", "filePath", "filename", "url") ??
    repo ??
    pickStr("query", "search", "q", "command", "cmd");
  const targetShort = target
    ? target.length > 64
      ? `…${target.slice(-63)}`
      : target
    : undefined;

  return (
    <div className="group/tool">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full max-w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors hover:bg-muted/50"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-md border",
            isPending && "border-primary/30 bg-primary/5",
            isDone && "border-border/60 bg-muted/40",
            isError && "border-destructive/40 bg-destructive/5",
          )}
        >
          <ToolIcon toolName={event.toolName} state={event.state} />
        </span>
        <span
          className={cn(
            "min-w-0 truncate font-medium text-foreground/90",
            isError && "text-destructive",
          )}
        >
          {msg ?? describeTool(event.toolName, event.args)}
        </span>
        {targetShort && (
          <span className="min-w-0 truncate font-mono text-[11.5px] text-muted-foreground/80">
            {targetShort}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {isError && (
            <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
              Error
            </span>
          )}
          {isPending && (
            <span className="text-[10.5px] font-medium uppercase tracking-wide text-primary/70">
              {TOOL_STATE_LABELS[event.state] ?? "Running"}
            </span>
          )}
          <ChevronRight
            className={cn(
              "size-3 text-muted-foreground/60 transition-transform",
              open && "rotate-90",
            )}
          />
        </span>
      </button>

      {open && (
        <div className="mt-1 ml-7 rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
          {event.args !== undefined && (
            <div className="mb-1">
              <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Input
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-foreground/80">
                {JSON.stringify(event.args, null, 2)}
              </pre>
            </div>
          )}
          {event.errorText && (
            <div className="mb-1">
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-destructive/80">
                  Error
                </span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetry(event);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-1.5 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                  >
                    <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 8a6 6 0 1 0 1.76-4.24M2 3v3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Retry
                  </button>
                )}
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-destructive">
                {event.errorText}
              </pre>
            </div>
          )}
          {event.result !== undefined && !event.errorText && (
            <div>
              <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Output
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-foreground/80">
                {typeof event.result === "string"
                  ? event.result
                  : JSON.stringify(event.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline atomic part renderers — progress / anchor / reference / warning /
// codeblock-uri / text-edit / confirmation / command-button / usage
// ---------------------------------------------------------------------------
function ProgressLine({ ev }: { ev: ProgressEvent }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[12px] italic text-muted-foreground/75">
      <Loader2 className="size-3 shrink-0 animate-spin" />
      <span className="truncate">{ev.text}</span>
    </div>
  );
}

function AnchorChip({ ev }: { ev: AnchorEvent }) {
  const label = ev.title ?? ev.uri.split(/[\\\/]/).pop() ?? ev.uri;
  return (
    <a
      href={ev.uri}
      className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 align-middle font-mono text-[11px] text-foreground/85 hover:border-border hover:bg-muted/70"
    >
      <FileText className="size-2.5 shrink-0" />
      <span className="truncate max-w-55">
        {label}
        {typeof ev.line === "number" ? `:${ev.line}` : ""}
      </span>
    </a>
  );
}

function ReferencePills({ refs }: { refs: ReferenceEvent[] }) {
  if (!refs.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {refs.map((r, i) => {
        const label = r.title ?? r.uri.split(/[\\\/]/).pop() ?? r.uri;
        const statusColor =
          r.status === "error"
            ? "text-destructive border-destructive/40"
            : r.status === "loading"
              ? "text-muted-foreground/60 border-border/40"
              : "text-muted-foreground border-border/60";
        return (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px]",
              statusColor
            )}
          >
            {r.status === "loading" && <Loader2 className="size-2.5 animate-spin" />}
            <span className="max-w-50 truncate">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

function WarningBanner({ ev }: { ev: WarningEvent }) {
  return (
    <div className="my-1 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{ev.text}</span>
    </div>
  );
}

function CodeblockUriHeader({ ev }: { ev: CodeblockUriEvent }) {
  return (
    <div className="-mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/75">
      <FileCode2 className="size-3" />
      <span className="font-mono">{ev.uri}</span>
      {ev.isEdit && <span className="text-amber-500/80">(edit)</span>}
    </div>
  );
}

function TextEditCard({ ev }: { ev: TextEditEvent }) {
  return (
    <div className="my-1 rounded-md border border-border/60 bg-muted/30 p-2 text-[12px]">
      <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
        <PencilLine className="size-3" />
        <span className="font-mono">{ev.target}</span>
        {ev.isDone && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
            <Check className="size-2.5" /> Done
          </span>
        )}
      </div>
      <pre className="overflow-x-auto font-mono text-[11px] text-foreground/80">
        {typeof ev.edits === "string" ? ev.edits : JSON.stringify(ev.edits, null, 2)}
      </pre>
    </div>
  );
}

function ConfirmationCard({
  ev,
  onResolve,
}: {
  ev: ConfirmationEvent;
  onResolve?: (id: string, choice: string) => void;
}) {
  return (
    <div className="my-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-[13px]">
      <div className="mb-1 font-medium text-foreground">{ev.title}</div>
      <div className="mb-2 text-muted-foreground">{ev.message}</div>
      <div className="flex flex-wrap gap-2">
        {ev.buttons.map((btn) => (
          <button
            key={btn}
            type="button"
            disabled={!!ev.resolution}
            onClick={() => onResolve?.(ev.confirmationId, btn)}
            className={cn(
              "rounded-md border px-3 py-1 text-[12px] transition-colors",
              ev.resolution === btn
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border/60 hover:border-border hover:bg-muted"
            )}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
}

function CommandButton({ ev }: { ev: CommandButtonEvent }) {
  return (
    <button
      type="button"
      className="my-1 inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[12px] hover:border-border hover:bg-muted"
      title={ev.command}
    >
      {ev.title}
    </button>
  );
}

function UsageBadge({ ev }: { ev: UsageEvent }) {
  return (
    <div className="mt-2 text-[10px] text-muted-foreground/50">
      {ev.totalTokens.toLocaleString()} tokens · {ev.promptTokens.toLocaleString()} in ·{" "}
      {ev.completionTokens.toLocaleString()} out
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolCallList — renders all tool calls in a left-bordered list
// ---------------------------------------------------------------------------
function ToolCallList({ events, onRetry }: { events: ToolCallEvent[]; onRetry?: (ev: ToolCallEvent) => void }) {
  if (!events.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-1">
      {events.map((ev, i) => (
        <ToolCallItem key={`${ev.toolCallId}-${i}`} event={ev} onRetry={onRetry} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReasoningBlock — collapsible reasoning with streaming text
// ---------------------------------------------------------------------------
function ReasoningBlock({
  reasoningEvents,
  isStreaming,
  activeToolNames,
}: {
  reasoningEvents: ReasoningPartEvent[];
  isStreaming: boolean;
  activeToolNames?: string[];
}) {
  const [open, setOpen] = useState(false);
  const text = reasoningEvents
    .filter((e) => e.type === "reasoning-delta")
    .map((e) => e.text)
    .join("")
    .trim();
  const elapsed = useElapsedTimer(isStreaming);
  const wasStreaming = useRef(false);

  // Auto-collapse the moment streaming finishes so the answer takes focus.
  useEffect(() => {
    if (isStreaming) {
      wasStreaming.current = true;
    } else if (wasStreaming.current) {
      setOpen(false);
      wasStreaming.current = false;
    }
  }, [isStreaming]);

  const effectiveOpen = isStreaming ? true : open;

  if (!text && !isStreaming) return null;

  const header = isStreaming
    ? `Thinking${elapsed > 0 ? ` · ${elapsed}s` : "…"}`
    : `Thought${elapsed > 0 ? ` for ${elapsed}s` : ""}`;
  const subtitle = isStreaming && activeToolNames && activeToolNames.length > 0 ? activeToolNames[0] : undefined;

  return (
    <div className="text-muted-foreground">
      <button
        type="button"
        onClick={() => !isStreaming && setOpen((v) => !v)}
        disabled={isStreaming}
        className={cn(
          "group/reasoning inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground/85 transition-colors",
          !isStreaming && "hover:bg-muted/60 hover:text-foreground",
          isStreaming && "cursor-default",
        )}
      >
        <Brain
          className={cn(
            "size-3.5 text-muted-foreground/70",
            isStreaming && "animate-(--animate-pulse-soft) text-primary/80",
          )}
        />
        <span>{header}</span>
        {subtitle && (
          <span className="hidden text-muted-foreground/60 sm:inline">
            · {subtitle}
          </span>
        )}
        {!isStreaming && (
          <svg
            className={cn(
              "size-3 text-muted-foreground/60 transition-transform",
              effectiveOpen && "rotate-180",
            )}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          effectiveOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-2 mt-1.5 border-l-2 border-border/70 pl-3">
            <p className="whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-muted-foreground/80">
              {text}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-sm bg-muted-foreground/60 align-middle animate-(--animate-blink)" />
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeBlockFenced — fenced code block with header bar + copy button
// ---------------------------------------------------------------------------
function CodeBlockFenced({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);
  const looksLikeCode =
    !!lang && !["text", "txt", "plaintext", "log", "output"].includes(lang.toLowerCase());
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-xl bg-[hsl(220,13%,14%)] text-[hsl(220,14%,90%)] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          {lang || "code"}
        </span>
        <div className="flex items-center gap-3">
          {looksLikeCode && (
            <button
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("copilot:apply-code", { detail: { code, lang } }),
                );
                setApplied(true);
                setTimeout(() => setApplied(false), 2000);
              }}
              className="flex items-center gap-1 text-[10px] text-white/40 transition-colors hover:text-white/70"
              title="Apply this code (dispatches copilot:apply-code event)"
            >
              {applied ? (
                <><Check className="size-3" /> Applied</>
              ) : (
                <><FileText className="size-3" /> Apply</>
              )}
            </button>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 text-[10px] text-white/40 transition-colors hover:text-white/70"
          >
            {copied ? (
              <><Check className="size-3" /> Copied</>
            ) : (
              <><Copy className="size-3" /> Copy</>
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceUrlPills — citation pills for web-search results
// ---------------------------------------------------------------------------
function SourceUrlPills({ urls }: { urls: SourceUrlEvent[] }) {
  if (!urls.length) return null;
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((u, i) => {
          let host = u.url;
          try {
            host = new URL(u.url).hostname.replace(/^www\./, "");
          } catch {
            /* noop */
          }
          return (
            <a
              key={i}
              href={u.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 hover:text-foreground"
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground/80 group-hover:bg-primary/15 group-hover:text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 truncate">{u.title || host}</span>
              <span className="hidden shrink-0 font-mono text-[10.5px] text-muted-foreground/60 sm:inline">
                {host}
              </span>
              <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildSegments — groups orderedParts into ordered interleaved render segments
// ---------------------------------------------------------------------------
type RenderSegment =
  | { kind: "reasoning"; events: ReasoningPartEvent[] }
  | { kind: "tools"; tools: ToolCallEvent[] }
  | { kind: "text"; events: TextDeltaEvent[] }
  | { kind: "sources"; urls: SourceUrlEvent[] }
  | { kind: "references"; refs: ReferenceEvent[] }
  | { kind: "progress"; ev: ProgressEvent }
  | { kind: "anchor"; ev: AnchorEvent }
  | { kind: "warning"; ev: WarningEvent }
  | { kind: "codeblock-uri"; ev: CodeblockUriEvent }
  | { kind: "text-edit"; ev: TextEditEvent }
  | { kind: "confirmation"; ev: ConfirmationEvent }
  | { kind: "command-button"; ev: CommandButtonEvent }
  | { kind: "usage"; ev: UsageEvent };

function buildSegments(parts: StreamPart[]): RenderSegment[] {
  const segs: RenderSegment[] = [];
  const seenToolIds = new Set<string>();

  for (const part of parts) {
    const last = segs[segs.length - 1];

    if (
      part.type === "reasoning-start" ||
      part.type === "reasoning-delta" ||
      part.type === "reasoning-end"
    ) {
      if (last?.kind === "reasoning") {
        last.events.push(part as ReasoningPartEvent);
      } else {
        segs.push({ kind: "reasoning", events: [part as ReasoningPartEvent] });
      }
    } else if (part.type.startsWith("tool-call")) {
      const t = part as ToolCallEvent;
      if (seenToolIds.has(t.toolCallId)) continue;
      seenToolIds.add(t.toolCallId);
      if (last?.kind === "tools") {
        last.tools.push(t);
      } else {
        segs.push({ kind: "tools", tools: [t] });
      }
    } else if (part.type === "text-delta" || part.type === "text-end") {
      if (last?.kind === "text") {
        last.events.push(part as TextDeltaEvent);
      } else {
        segs.push({ kind: "text", events: [part as TextDeltaEvent] });
      }
    } else if (part.type === "source-url") {
      if (last?.kind === "sources") {
        last.urls.push(part as SourceUrlEvent);
      } else {
        segs.push({ kind: "sources", urls: [part as SourceUrlEvent] });
      }
    } else if (part.type === "reference") {
      if (last?.kind === "references") {
        last.refs.push(part as ReferenceEvent);
      } else {
        segs.push({ kind: "references", refs: [part as ReferenceEvent] });
      }
    } else if (part.type === "progress") {
      segs.push({ kind: "progress", ev: part as ProgressEvent });
    } else if (part.type === "anchor") {
      segs.push({ kind: "anchor", ev: part as AnchorEvent });
    } else if (part.type === "warning") {
      segs.push({ kind: "warning", ev: part as WarningEvent });
    } else if (part.type === "codeblock-uri") {
      segs.push({ kind: "codeblock-uri", ev: part as CodeblockUriEvent });
    } else if (part.type === "text-edit") {
      segs.push({ kind: "text-edit", ev: part as TextEditEvent });
    } else if (part.type === "confirmation") {
      segs.push({ kind: "confirmation", ev: part as ConfirmationEvent });
    } else if (part.type === "command-button") {
      segs.push({ kind: "command-button", ev: part as CommandButtonEvent });
    } else if (part.type === "usage") {
      segs.push({ kind: "usage", ev: part as UsageEvent });
    }
  }

  return segs;
}

// ---------------------------------------------------------------------------
// StreamingText — markdown with react-markdown, code highlighting, live cursor
// ---------------------------------------------------------------------------
function StreamingText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  if (!text) return null;

  function CodeBlock({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] text-foreground">
          {children}
        </code>
      );
    }
    const lang = className?.replace("language-", "") ?? "";
    return <CodeBlockFenced code={String(children ?? "").replace(/\n$/, "")} lang={lang} />;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none wrap-break-word leading-relaxed text-foreground",
        "prose-headings:font-heading prose-headings:text-foreground prose-p:my-1.5",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
        {text}
      </Markdown>
      {isStreaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 animate-(--animate-blink) align-text-bottom bg-foreground" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssistantAvatar + AssistantLabel — shared UI elements
// ---------------------------------------------------------------------------
function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
      <svg viewBox="0 0 24 24" className="size-4.5 text-foreground fill-current">
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
      </svg>
    </div>
  );
}

function AssistantLabel() {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-normal text-muted-foreground/65">
      <span>Operon</span>
      <span className="h-px w-3 bg-border/70" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserMessage — right-aligned bubble (no label)
// ---------------------------------------------------------------------------
function UserMessage({ text }: { text: string }) {
  return (
    <div className="group/user mt-4 mb-2 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-primary-foreground shadow-xs">
        <p className="whitespace-pre-wrap wrap-break-word text-[14px] leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SystemMessage — centered system message pill
// ---------------------------------------------------------------------------
function SystemMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
        {text}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CopyButton — copy text content
// ---------------------------------------------------------------------------
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {copied ? <Check className="size-3.5" /> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// StreamingAssistantMessage — Copilot-style: full width, no avatar, no label
// ---------------------------------------------------------------------------
function StreamingAssistantMessage({
  message,
  isLoading,
  onRegenerate,
  onConfirm,
  onRetryTool,
}: {
  message: StreamingMessage;
  isLoading: boolean;
  onRegenerate?: () => void;
  onConfirm?: (id: string, choice: string) => void;
  onRetryTool?: (ev: ToolCallEvent) => void;
}) {
  const isStreamingThis = isLoading && !message.isComplete;
  const segments = buildSegments(message.orderedParts);

  // Active tool names for the reasoning header
  const activeToolNames = segments
    .flatMap((s) => (s.kind === "tools" ? s.tools : []))
    .filter((t) =>
      ["calling", "input-streaming", "input-available", "executing"].includes(t.state)
    )
    .map((t) => describeTool(t.toolName, t.args));

  // Full text across all text segments — for copy button
  const allText = segments
    .filter((s): s is { kind: "text"; events: TextDeltaEvent[] } => s.kind === "text")
    .flatMap((s) => s.events)
    .map((e) => e.text)
    .join("");

  // Working indicator: streaming, but no text yet
  const hasText = segments.some((s) => s.kind === "text" && s.events.some((e) => e.text));
  const showWorking = isStreamingThis && !hasText;

  return (
    <div className="group/msg py-3">
      {showWorking && (
        <div className="mb-2 flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>{activeToolNames.length > 0 ? activeToolNames[0] : "Working"}…</span>
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg, i) => {
          const isLastSeg = isStreamingThis && i === segments.length - 1;

          if (seg.kind === "reasoning") {
            return (
              <ReasoningBlock
                key={i}
                reasoningEvents={seg.events}
                isStreaming={isLastSeg}
                activeToolNames={activeToolNames.length > 0 ? activeToolNames : undefined}
              />
            );
          }
          if (seg.kind === "tools") {
            return <ToolCallList key={i} events={seg.tools} onRetry={onRetryTool} />;
          }
          if (seg.kind === "text") {
            const text = seg.events.map((e) => e.text).join("");
            return text ? (
              <StreamingText key={i} text={text} isStreaming={isLastSeg} />
            ) : null;
          }
          if (seg.kind === "sources") {
            return <SourceUrlPills key={i} urls={seg.urls} />;
          }
          if (seg.kind === "references") {
            return <ReferencePills key={i} refs={seg.refs} />;
          }
          if (seg.kind === "progress") {
            return <ProgressLine key={i} ev={seg.ev} />;
          }
          if (seg.kind === "anchor") {
            return <AnchorChip key={i} ev={seg.ev} />;
          }
          if (seg.kind === "warning") {
            return <WarningBanner key={i} ev={seg.ev} />;
          }
          if (seg.kind === "codeblock-uri") {
            return <CodeblockUriHeader key={i} ev={seg.ev} />;
          }
          if (seg.kind === "text-edit") {
            return <TextEditCard key={i} ev={seg.ev} />;
          }
          if (seg.kind === "confirmation") {
            return <ConfirmationCard key={i} ev={seg.ev} onResolve={onConfirm} />;
          }
          if (seg.kind === "command-button") {
            return <CommandButton key={i} ev={seg.ev} />;
          }
          if (seg.kind === "usage") {
            return <UsageBadge key={i} ev={seg.ev} />;
          }
          return null;
        })}

        {/* Per-message toolbar — Copilot-style: copy / regenerate, hover only */}
        {allText && !isStreamingThis && (
          <MessageToolbar text={allText} onRegenerate={onRegenerate} />
        )}

        {/* Used references (Copilot-parity) — collapsible at bottom of message */}
        {!isStreamingThis && <UsedReferencesSection segments={segments} />}
      </div>
    </div>
  );
}

// Per-message hover toolbar (Copilot-parity)
function MessageToolbar({
  text,
  onRegenerate,
}: {
  text: string;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
      <button
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        title="Copy"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          title="Regenerate"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 8a6 6 0 1 0 1.76-4.24M2 3v3.5h3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatMessageRow — routes based on role
// ---------------------------------------------------------------------------
function ChatMessageRow({
  message,
  isLoading,
  onConfirm,
  onRetryTool,
  onRegenerate,
}: {
  message: StreamingMessage;
  isLoading: boolean;
  onConfirm?: (id: string, choice: string) => void;
  onRetryTool?: (ev: ToolCallEvent) => void;
  onRegenerate?: () => void;
}) {
  if (message.role === "user") {
    const text = message.orderedParts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as TextDeltaEvent).text)
      .join("");
    return <UserMessage text={text} />;
  }
  return (
    <StreamingAssistantMessage
      message={message}
      isLoading={isLoading}
      onConfirm={onConfirm}
      onRetryTool={onRetryTool}
      onRegenerate={onRegenerate}
    />
  );
}

// ---------------------------------------------------------------------------
// ChatMessageList — the main exported list component
// ---------------------------------------------------------------------------
export function StreamingChatMessageList({
  messages,
  isLoading,
  onConfirm,
  onRetryTool,
  onRegenerate,
}: {
  messages: StreamingMessage[];
  isLoading: boolean;
  onConfirm?: (id: string, choice: string) => void;
  onRetryTool?: (ev: ToolCallEvent) => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {messages.map((message, idx) => (
        <ChatMessageRow
          key={message.id}
          message={message}
          isLoading={isLoading}
          onConfirm={onConfirm}
          onRetryTool={onRetryTool}
          onRegenerate={
            // Only the most recent assistant message gets regenerate
            idx === messages.length - 1 && message.role === "assistant" ? onRegenerate : undefined
          }
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UsedReferencesSection — Copilot-style "Used N references" collapsible
// ---------------------------------------------------------------------------
function UsedReferencesSection({ segments }: { segments: RenderSegment[] }) {
  const [open, setOpen] = useState(false);

  // Collect everything that counts as a "reference used" by the agent.
  type UsedRef = { kind: string; label: string; uri?: string };
  const refs: UsedRef[] = [];
  for (const s of segments) {
    if (s.kind === "references") {
      for (const r of s.refs) refs.push({ kind: "reference", label: r.title ?? r.uri, uri: r.uri });
    } else if (s.kind === "anchor") {
      refs.push({ kind: "anchor", label: s.ev.title ?? s.ev.uri, uri: s.ev.uri });
    } else if (s.kind === "sources") {
      for (const u of s.urls) refs.push({ kind: "source", label: u.title ?? u.url, uri: u.url });
    } else if (s.kind === "tools") {
      for (const t of s.tools) {
        const args = t.args as Record<string, unknown> | undefined;
        const uri = args && typeof args.path === "string" ? args.path : undefined;
        if (uri) refs.push({ kind: "tool", label: uri, uri });
      }
    }
  }

  // De-dup by uri+label
  const seen = new Set<string>();
  const unique = refs.filter((r) => {
    const key = `${r.uri ?? r.label}|${r.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) return null;

  return (
    <div className="mt-2 text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-muted-foreground/70 hover:text-muted-foreground"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        <span>
          Used {unique.length} {unique.length === 1 ? "reference" : "references"}
        </span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 border-l border-border/60 pl-3">
          {unique.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground/75">
              <FileText className="size-2.5 shrink-0" />
              {r.uri ? (
                <a href={r.uri} className="truncate hover:text-foreground">{r.label}</a>
              ) : (
                <span className="truncate">{r.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Re-export types
export type {
  StreamingMessage,
  StreamPart,
  ReasoningPartEvent,
  ToolCallEvent,
  TextDeltaEvent,
  SourceUrlEvent,
} from "@/hooks/use-stream-events/types";
