"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
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
import { getToolLabel, TOOL_STATE_LABELS } from "@/hooks/use-stream-events/types";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Circle,
  Copy,
  ExternalLink,
  FileCode2,
  GitBranch,
  Loader2,
  MessageSquareText,
  PencilLine,
  Search,
  ChevronRight,
  FileText,
} from "lucide-react";

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
  if (toolName.includes("github") || toolName.includes("branch") || toolName.includes("pr"))
    return <GitBranch className={cls} />;
  if (toolName.includes("search")) return <Search className={cls} />;
  if (toolName.includes("write") || toolName.includes("edit") || toolName.includes("push"))
    return <PencilLine className={cls} />;
  if (toolName.includes("file") || toolName.includes("code")) return <FileCode2 className={cls} />;
  if (toolName.includes("message") || toolName.includes("chat")) return <MessageSquareText className={cls} />;
  return <Check className={cls} />;
}

// ---------------------------------------------------------------------------
// ToolCallItem — Copilot-style: invocationMessage during, pastTenseMessage after,
// collapsible to reveal args + result.
// ---------------------------------------------------------------------------
function ToolCallItem({ event }: { event: ToolCallEvent }) {
  const [open, setOpen] = useState(false);
  const isPending = ["calling", "input-streaming", "input-available", "executing"].includes(
    event.state
  );
  const isError = event.state === "output-error";

  // Prefer Copilot-style messages when present, otherwise fall back to the
  // raw tool name + an extracted detail.
  const msg = isPending
    ? event.invocationMessage
    : (event.pastTenseMessage ?? event.invocationMessage);

  const fallbackDetail = (() => {
    if (event.result && typeof event.result === "object") {
      const r = event.result as Record<string, unknown>;
      return (
        r.path ??
        r.filePath ??
        r.filename ??
        r.query ??
        r.search ??
        (r.owner && r.repo ? `${r.owner}/${r.repo}` : null)
      );
    }
    if (event.args && typeof event.args === "object") {
      const a = event.args as Record<string, unknown>;
      return (
        a.path ??
        a.filePath ??
        a.query ??
        a.search ??
        (a.owner && a.repo ? `${a.owner}/${a.repo}` : null)
      );
    }
    return null;
  })();

  return (
    <div className="group/tool relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 py-1 text-left text-[13px] text-muted-foreground hover:text-foreground/80"
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
          <ToolIcon toolName={event.toolName} state={event.state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {msg ? (
              <span
                className={cn(
                  "truncate",
                  isError && "text-destructive"
                )}
                /* invocationMessage / pastTenseMessage are markdown-ish; render plain. */
              >
                {msg}
              </span>
            ) : (
              <>
                <span className={cn("truncate", isError && "text-destructive")}>
                  {getToolLabel(event.toolName)}
                </span>
                <span className="shrink-0 text-[12px] text-muted-foreground/55">
                  {TOOL_STATE_LABELS[event.state] ?? event.state}
                </span>
              </>
            )}
            <ChevronRight
              className={cn(
                "ml-auto size-3 shrink-0 text-muted-foreground/40 transition-transform",
                open && "rotate-90"
              )}
            />
          </div>
          {!msg && fallbackDetail && (
            <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/50">
              {typeof fallbackDetail === "string" ? fallbackDetail : JSON.stringify(fallbackDetail)}
            </div>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-1 ml-6 rounded-md border border-border/60 bg-muted/30 p-2 text-[11px]">
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
              <div className="mb-0.5 font-mono text-[10px] uppercase tracking-wider text-destructive/80">
                Error
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
function ToolCallList({ events }: { events: ToolCallEvent[] }) {
  if (!events.length) return null;
  return (
    <div className="relative ml-0.5 border-l border-border/70 pl-3">
      {events.map((ev, i) => (
        <div key={`${ev.toolCallId}-${i}`} className="relative">
          <span className="absolute -left-4 top-3 flex size-2 items-center justify-center bg-background">
            <Circle className="size-1.5 fill-background text-border" />
          </span>
          <ToolCallItem event={ev} />
        </div>
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
    .map((e) => e.text)
    .join("")
    .trim();
  const elapsed = useElapsedTimer(isStreaming);
  const effectiveOpen = open || !!isStreaming;

  if (!text && !isStreaming) return null;

  const header = isStreaming
    ? `Thinking${elapsed > 0 ? ` ${elapsed}s` : "…"}`
    : `Thought${elapsed > 0 ? ` for ${elapsed}s` : ""}`;

  return (
    <div className="text-muted-foreground">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group/reasoning inline-flex items-center gap-1.5 text-[12px] italic leading-none text-muted-foreground/80 hover:text-muted-foreground"
      >
        <span className="text-primary/70">*</span>
        <span>{header}</span>
        {activeToolNames && activeToolNames.length > 0 && (
          <span className="text-[11px] text-primary/40">
            · {activeToolNames.join(", ")}
          </span>
        )}
        <svg
          className={cn(
            "size-3 transition-transform",
            effectiveOpen && "rotate-90"
          )}
          viewBox="0 0 16 16"
          fill="none"
        >
          <path
            d="M6 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
          effectiveOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mt-2 border-l border-border/70 pl-3">
          <p className="whitespace-pre-wrap text-[12px] italic leading-relaxed text-muted-foreground/75">
            {text}
            {isStreaming && (
              <span className="ml-0.5 inline-block w-px h-3 bg-muted-foreground/60 align-middle animate-(--animate-blink)" />
            )}
          </p>
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
  return (
    <div className="group/code relative my-2 overflow-hidden rounded-xl bg-[hsl(220,13%,14%)] text-[hsl(220,14%,90%)] ring-1 ring-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          {lang || "code"}
        </span>
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
    <div className="mt-1 flex flex-wrap gap-1.5">
      {urls.map((u, i) => {
        let host = u.url;
        try { host = new URL(u.url).hostname.replace("www.", ""); } catch { /* noop */ }
        return (
          <a
            key={i}
            href={u.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:text-foreground"
          >
            <ExternalLink className="size-2.5 shrink-0" />
            <span className="max-w-45 truncate">{u.title || host}</span>
          </a>
        );
      })}
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
// UserMessage — Copilot-style: subtle bg, full width, no big bubble
// ---------------------------------------------------------------------------
function UserMessage({ text }: { text: string }) {
  return (
    <div className="group/user mt-4 mb-2 rounded-lg border border-border/40 bg-muted/30 px-3.5 py-2.5">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        You
      </div>
      <p className="whitespace-pre-wrap wrap-break-word text-[14px] leading-relaxed text-foreground">
        {text}
      </p>
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
}: {
  message: StreamingMessage;
  isLoading: boolean;
  onRegenerate?: () => void;
}) {
  const isStreamingThis = isLoading && !message.isComplete;
  const segments = buildSegments(message.orderedParts);

  // Active tool names for the reasoning header
  const activeToolNames = segments
    .flatMap((s) => (s.kind === "tools" ? s.tools : []))
    .filter((t) =>
      ["calling", "input-streaming", "input-available", "executing"].includes(t.state)
    )
    .map((t) => getToolLabel(t.toolName));

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
            return <ToolCallList key={i} events={seg.tools} />;
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
            return <ConfirmationCard key={i} ev={seg.ev} />;
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
}: {
  message: StreamingMessage;
  isLoading: boolean;
}) {
  if (message.role === "user") {
    const text = message.orderedParts
      .filter((p) => p.type === "text-delta")
      .map((p) => (p as TextDeltaEvent).text)
      .join("");
    return <UserMessage text={text} />;
  }
  return (
    <StreamingAssistantMessage message={message} isLoading={isLoading} />
  );
}

// ---------------------------------------------------------------------------
// ChatMessageList — the main exported list component
// ---------------------------------------------------------------------------
export function StreamingChatMessageList({
  messages,
  isLoading,
}: {
  messages: StreamingMessage[];
  isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {messages.map((message) => (
        <ChatMessageRow
          key={message.id}
          message={message}
          isLoading={isLoading}
        />
      ))}
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
