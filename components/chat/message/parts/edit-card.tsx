"use client";

// ---------------------------------------------------------------------------
// EditCard — VS Code-style file-edit visualisation.
//
// Detects `apply_patch` (unified diff in `event.args.diff`) and `write_file`
// (new file contents in `event.args.contents`) tool calls and renders a card
// with: file pill header → per-line diff body (additions green, deletions
// red, faded context). Folds when total changed lines > 40.
//
// This is RENDERED INSTEAD of the generic ToolCallItem when the tool name +
// payload match. Non-coding tools fall through to the normal pill — this
// component is opt-in by shape.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { ChevronRight, FileText, FilePlus2, AlertCircle, Loader2 } from "lucide-react";
import type { ToolCallEvent } from "@/hooks/use-stream-events/types";
import { cn } from "@/lib/utils";

const FOLD_THRESHOLD = 40;
const COLLAPSED_LINES = 24;

export type EditCardKind = "patch" | "write";

export type EditPayload = {
  kind: EditCardKind;
  path: string;
  // Diff-derived. For "write" we synthesise from the new contents (all lines
  // are additions).
  hunks: Array<{
    header?: string;
    lines: Array<{ kind: "+" | "-" | " "; text: string }>;
  }>;
  added: number;
  removed: number;
};

/** Returns null if this tool call is NOT an edit. */
export function detectEdit(event: ToolCallEvent): EditPayload | null {
  const args = event.args ?? {};

  if (event.toolName === "apply_patch" && typeof args.diff === "string") {
    return parseUnifiedDiff(args.diff as string);
  }

  // write_file (local coding workspace) and github_write_file (web / GitHub
  // API mode) share the same args shape: { path, contents }.
  if (
    (event.toolName === "write_file" || event.toolName === "github_write_file") &&
    typeof args.path === "string" &&
    typeof args.contents === "string"
  ) {
    const contents = args.contents as string;
    const lines = contents.split("\n");
    return {
      kind: "write",
      path: args.path as string,
      hunks: [
        {
          lines: lines.map((text) => ({ kind: "+" as const, text })),
        },
      ],
      added: lines.length,
      removed: 0,
    };
  }

  return null;
}

/** Minimal unified-diff parser. Accepts standard `--- a/x +++ b/x @@ ...` blocks. */
function parseUnifiedDiff(diff: string): EditPayload {
  const lines = diff.split("\n");
  let path = "";
  const hunks: EditPayload["hunks"] = [];
  let current: EditPayload["hunks"][number] | null = null;
  let added = 0;
  let removed = 0;

  for (const ln of lines) {
    if (ln.startsWith("+++ ")) {
      const after = ln.slice(4).trim();
      // Strip leading "b/" or timestamp suffix.
      path = after.replace(/^b\//, "").split("\t")[0];
      continue;
    }
    if (ln.startsWith("--- ")) continue;
    if (ln.startsWith("@@")) {
      current = { header: ln, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (ln.startsWith("+")) {
      current.lines.push({ kind: "+", text: ln.slice(1) });
      added++;
    } else if (ln.startsWith("-")) {
      current.lines.push({ kind: "-", text: ln.slice(1) });
      removed++;
    } else if (ln.startsWith(" ") || ln === "") {
      current.lines.push({ kind: " ", text: ln.startsWith(" ") ? ln.slice(1) : ln });
    }
  }

  return {
    kind: "patch",
    path: path || "(unknown)",
    hunks,
    added,
    removed,
  };
}

export function EditCard({
  event,
  payload,
}: {
  event: ToolCallEvent;
  payload: EditPayload;
}) {
  const totalChanged = payload.added + payload.removed;
  const [open, setOpen] = useState(totalChanged <= FOLD_THRESHOLD);

  const isPending = ["calling", "input-streaming", "input-available", "executing"].includes(event.state);
  const isError = event.state === "output-error";

  const flatLines = useMemo(() => payload.hunks.flatMap((h) => h.lines), [payload]);
  const showFade = open && flatLines.length > COLLAPSED_LINES;
  const visible = showFade ? flatLines.slice(0, COLLAPSED_LINES) : flatLines;
  const hidden = flatLines.length - visible.length;

  const Icon = payload.kind === "write" ? FilePlus2 : FileText;

  return (
    <div className="my-1 overflow-hidden rounded-lg border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5 text-left text-[12px] text-muted-foreground transition-colors hover:bg-muted/50",
          !open && "border-b-0",
        )}
      >
        {isError ? (
          <AlertCircle className="size-3.5 shrink-0 text-destructive" />
        ) : isPending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground/70" />
        ) : (
          <Icon className="size-3.5 shrink-0 text-muted-foreground/80" />
        )}
        <span className="truncate font-mono text-foreground/85">{payload.path}</span>
        {!isPending && !isError && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-2 text-[11px] tabular-nums">
            {payload.added > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{payload.added}</span>}
            {payload.removed > 0 && <span className="text-rose-600 dark:text-rose-400">−{payload.removed}</span>}
          </span>
        )}
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground/45 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="relative">
          <div className="overflow-x-auto font-mono text-[11.5px] leading-snug">
            {visible.map((l, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 whitespace-pre px-3 py-px",
                  l.kind === "+" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  l.kind === "-" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
                  l.kind === " " && "text-muted-foreground/70",
                )}
              >
                <span className="w-3 shrink-0 select-none text-muted-foreground/50">
                  {l.kind === " " ? "" : l.kind}
                </span>
                <span className="min-w-0 flex-1">{l.text || "\u00A0"}</span>
              </div>
            ))}
          </div>
          {hidden > 0 && (
            <div className="border-t border-border/40 bg-muted/30 px-3 py-1 text-[10.5px] text-muted-foreground/75">
              {hidden} more {hidden === 1 ? "line" : "lines"} not shown
            </div>
          )}
        </div>
      )}
    </div>
  );
}
