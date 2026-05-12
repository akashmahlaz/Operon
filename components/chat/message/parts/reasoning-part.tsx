"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ReasoningPartProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

/**
 * Copilot-style inline reasoning:
 * Copilot-style inline reasoning: live prose with a left bar while streaming,
 * then the same quiet block after completion.
 */
export function ReasoningPart({ text, streaming, className }: ReasoningPartProps) {
  const [open, setOpen] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!streaming) return;
    startRef.current = Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      500,
    );
    return () => clearInterval(id);
  }, [streaming]);

  if (!text && !streaming) return null;

  return (
    <div className={cn("text-muted-foreground", className)}>
      {open && (
        <div className="border-l-2 border-border/70 pl-3">
          <p className="whitespace-pre-wrap text-[12.5px] italic leading-relaxed text-muted-foreground/85">
            {text}
            {streaming && (
              <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-sm bg-muted-foreground/60 align-middle animate-(--animate-blink)" />
            )}
          </p>
        </div>
      )}

      {!streaming && elapsed > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
        >
          <span>{open ? "Thought" : "Show thinking"}</span>
          <span>-</span>
          <span>{elapsed}s</span>
        </button>
      )}
    </div>
  );
}
