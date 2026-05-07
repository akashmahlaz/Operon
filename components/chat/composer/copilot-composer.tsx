"use client";

/**
 * CopilotComposer — Copilot Chat-style input box.
 *
 * Features (parity with VS Code Copilot Chat):
 *   • Slash commands  /explain /fix /tests /clear /new
 *   • Participants    @workspace @terminal @github
 *   • References      #path/to/file (manual)
 *   • Model picker chip (controlled prop)
 *   • Tool toggle     enable/disable tool calls
 *   • Stop button while streaming
 *   • Enter sends, Shift+Enter newline; arrow keys navigate completion menu
 *
 * Stateless about transport: parent owns `value`, `onChange`, `onSubmit`,
 * `isStreaming`, `onStop`. Mirrors how Copilot's `ChatInputPart` is wired
 * to its view model.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  AtSign,
  Hash,
  Loader2,
  Paperclip,
  Slash,
  Square,
  Wrench,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Built-in suggestion catalogues ───────────────────────────────────────

export interface SlashCommand {
  name: string;
  description: string;
}
export interface Participant {
  name: string;
  description: string;
}

export const DEFAULT_SLASH_COMMANDS: SlashCommand[] = [
  { name: "explain", description: "Explain how this code works" },
  { name: "fix", description: "Fix the problem in the selected code" },
  { name: "tests", description: "Generate unit tests" },
  { name: "new", description: "Start a new conversation" },
  { name: "clear", description: "Clear this conversation" },
];

export const DEFAULT_PARTICIPANTS: Participant[] = [
  { name: "workspace", description: "Ask about your workspace" },
  { name: "terminal", description: "Ask about the terminal" },
  { name: "github", description: "Ask about GitHub" },
];

// ── Public API ───────────────────────────────────────────────────────────

export interface CopilotComposerProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: (text: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;

  /** Optional model picker. */
  model?: string;
  models?: string[];
  onModelChange?: (model: string) => void;

  /** Tool toggle. When false, the agent should skip tool calls. */
  toolsEnabled?: boolean;
  onToolsToggle?: (enabled: boolean) => void;

  /** File attachments. */
  attachments?: { name: string }[];
  onAttachFile?: (file: File) => void;
  onRemoveAttachment?: (index: number) => void;

  /** Override suggestion catalogues. */
  slashCommands?: SlashCommand[];
  participants?: Participant[];

  /** Optional file/symbol picker for `#` references. Returns matches for the query. */
  resolveReferences?: (query: string) => Promise<{ uri: string; label?: string }[]>;

  /** Footer hint (right-aligned). */
  footerHint?: string;
}

// ── Trigger detection ────────────────────────────────────────────────────

type TriggerKind = "slash" | "participant" | "reference" | null;

interface ActiveTrigger {
  kind: TriggerKind;
  /** Token after the trigger char, e.g. "expl" for `/expl`. */
  query: string;
  /** Position of the trigger char in `value`. */
  start: number;
}

function detectTrigger(value: string, caret: number): ActiveTrigger {
  // Look at the token immediately to the left of the caret.
  const before = value.slice(0, caret);
  const match = /([\/@#])([\w./-]*)$/.exec(before);
  if (!match) return { kind: null, query: "", start: -1 };
  const [, char, token] = match;
  const start = caret - token.length - 1;
  // `/` only counts at the very start (or after a newline).
  if (char === "/" && start !== 0 && value[start - 1] !== "\n") {
    return { kind: null, query: "", start: -1 };
  }
  const kind: TriggerKind =
    char === "/" ? "slash" : char === "@" ? "participant" : "reference";
  return { kind, query: token, start };
}

// ── Component ────────────────────────────────────────────────────────────

export function CopilotComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  isStreaming,
  disabled,
  placeholder,
  model,
  models,
  onModelChange,
  toolsEnabled = true,
  onToolsToggle,
  attachments = [],
  onAttachFile,
  onRemoveAttachment,
  slashCommands = DEFAULT_SLASH_COMMANDS,
  participants = DEFAULT_PARTICIPANTS,
  resolveReferences,
  footerHint,
}: CopilotComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trigger, setTrigger] = useState<ActiveTrigger>({ kind: null, query: "", start: -1 });
  const [refMatches, setRefMatches] = useState<{ uri: string; label?: string }[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  // Auto-grow.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [value]);

  // Resolve `#` references asynchronously.
  useEffect(() => {
    if (trigger.kind !== "reference" || !resolveReferences) return;
    let cancelled = false;
    resolveReferences(trigger.query).then((results) => {
      if (!cancelled) setRefMatches(results.slice(0, 8));
    });
    return () => {
      cancelled = true;
    };
  }, [trigger.kind, trigger.query, resolveReferences]);

  // Filtered suggestions for the current trigger.
  const suggestions = useMemo(() => {
    if (trigger.kind === "slash") {
      const q = trigger.query.toLowerCase();
      return slashCommands
        .filter((c) => c.name.toLowerCase().startsWith(q))
        .map((c) => ({ key: c.name, label: `/${c.name}`, description: c.description }));
    }
    if (trigger.kind === "participant") {
      const q = trigger.query.toLowerCase();
      return participants
        .filter((p) => p.name.toLowerCase().startsWith(q))
        .map((p) => ({ key: p.name, label: `@${p.name}`, description: p.description }));
    }
    if (trigger.kind === "reference") {
      return refMatches.map((m) => ({
        key: m.uri,
        label: `#${m.label ?? m.uri}`,
        description: m.uri,
      }));
    }
    return [];
  }, [trigger, slashCommands, participants, refMatches]);

  // Reset highlight when suggestions change.
  useEffect(() => {
    setActiveIndex(0);
  }, [suggestions.length, trigger.kind]);

  function applySuggestion(key: string) {
    if (trigger.kind === null || trigger.start < 0) return;
    const before = value.slice(0, trigger.start);
    const after = value.slice(trigger.start + 1 + trigger.query.length);
    const insertion =
      trigger.kind === "slash"
        ? `/${key} `
        : trigger.kind === "participant"
          ? `@${key} `
          : `#${key} `;
    const next = before + insertion + after;
    onChange(next);
    setTrigger({ kind: null, query: "", start: -1 });
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = (before + insertion).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    setTrigger(detectTrigger(next, e.target.selectionStart ?? next.length));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Suggestion menu navigation.
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applySuggestion(suggestions[activeIndex].key);
        return;
      }
      if (e.key === "Escape") {
        setTrigger({ kind: null, query: "", start: -1 });
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        onSubmit(value);
      }
    }
  }

  function triggerIcon(kind: TriggerKind) {
    if (kind === "slash") return <Slash className="size-3" />;
    if (kind === "participant") return <AtSign className="size-3" />;
    if (kind === "reference") return <Hash className="size-3" />;
    return null;
  }

  return (
    <div className="relative">
      {/* Suggestion popover */}
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-10 max-h-64 overflow-y-auto rounded-xl border border-border/70 bg-popover p-1 shadow-lg">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
            {triggerIcon(trigger.kind)}
            <span>
              {trigger.kind === "slash"
                ? "Commands"
                : trigger.kind === "participant"
                  ? "Participants"
                  : "References"}
            </span>
          </div>
          {suggestions.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySuggestion(s.key);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-[13px]",
                i === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/85 hover:bg-accent/60",
              )}
            >
              <span className="font-mono truncate">{s.label}</span>
              <span className="truncate text-[11px] text-muted-foreground/70">
                {s.description}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((att, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-foreground/85"
            >
              <Paperclip className="size-2.5" />
              <span className="max-w-50 truncate">{att.name}</span>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => onRemoveAttachment?.(i)}
                className="text-muted-foreground/60 hover:text-foreground"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Composer body */}
      <div
        className={cn(
          "flex flex-col gap-2 rounded-2xl border border-border/70 bg-card px-3 py-2 shadow-sm transition-colors",
          "focus-within:border-foreground/40",
          (disabled || isStreaming) && "opacity-90",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() =>
            // Hide suggestions on blur (but allow click-to-apply via onMouseDown).
            setTimeout(() => setTrigger({ kind: null, query: "", start: -1 }), 100)
          }
          disabled={disabled}
          placeholder={
            placeholder ??
            (isStreaming
              ? "Operon is responding…"
              : "Ask Operon · / for commands · @ for participants · # for files")
          }
          rows={1}
          className="max-h-60 w-full resize-none bg-transparent px-1 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
          style={{ scrollbarWidth: "none" }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {onAttachFile && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onAttachFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  aria-label="Attach file"
                  disabled={disabled || isStreaming}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Paperclip className="size-3.5" />
                </button>
              </>
            )}
            {onToolsToggle && (
              <button
                type="button"
                aria-label={toolsEnabled ? "Disable tools" : "Enable tools"}
                disabled={disabled || isStreaming}
                onClick={() => onToolsToggle(!toolsEnabled)}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-md px-2 text-[11px] transition-colors disabled:opacity-40",
                  toolsEnabled
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
                title={toolsEnabled ? "Tools enabled" : "Tools disabled"}
              >
                <Wrench className="size-3" />
                <span>Tools</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Model picker chip */}
            {models && models.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  disabled={disabled || isStreaming}
                  onClick={() => setShowModelMenu((v) => !v)}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <span className="font-mono">{model ?? models[0]}</span>
                  <ChevronDown className="size-3" />
                </button>
                {showModelMenu && (
                  <div className="absolute bottom-full right-0 mb-1 z-10 min-w-40 rounded-md border border-border/70 bg-popover p-1 shadow-lg">
                    {models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          onModelChange?.(m);
                          setShowModelMenu(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-start rounded px-2 py-1 text-left text-[12px] hover:bg-accent",
                          m === model && "text-foreground",
                        )}
                      >
                        <span className="font-mono">{m}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                type="button"
                aria-label="Stop"
                onClick={() => onStop?.()}
                className="flex size-7 items-center justify-center rounded-md bg-foreground text-background"
              >
                <Square className="size-3 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Send"
                disabled={!canSend}
                onClick={() => canSend && onSubmit(value)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-all",
                  canSend
                    ? "bg-foreground text-background hover:scale-105 active:scale-95"
                    : "bg-muted text-muted-foreground/60",
                )}
              >
                {disabled ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="size-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>Enter to send · Shift+Enter for newline</span>
        {footerHint && <span className="font-mono">{footerHint}</span>}
      </div>
    </div>
  );
}
