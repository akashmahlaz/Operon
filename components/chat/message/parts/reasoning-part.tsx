"use client";

import { useEffect, useRef, useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningPartProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function ReasoningPart({ text, streaming, className }: ReasoningPartProps) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const wasStreaming = useRef(false);

  // Auto-open while streaming, auto-collapse the moment streaming finishes.
  const effectiveOpen = streaming ? true : open;

  useEffect(() => {
    if (streaming) {
      wasStreaming.current = true;
      startRef.current = Date.now();
      const id = setInterval(
        () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
        500,
      );
      return () => clearInterval(id);
    }
    if (wasStreaming.current) {
      // On finish, collapse so the answer takes focus (Copilot behaviour).
      setOpen(false);
      wasStreaming.current = false;
    }
  }, [streaming]);

  if (!text && !streaming) return null;

  const header = streaming
    ? `Thinking${elapsed > 0 ? ` · ${elapsed}s` : "…"}`
    : `Thought${elapsed > 0 ? ` for ${elapsed}s` : ""}`;

  return (
    <div className={cn("text-muted-foreground", className)}>
      <button
        type="button"
        onClick={() => !streaming && setOpen((v) => !v)}
        disabled={streaming}
        className={cn(
          "group/reasoning inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground/85 transition-colors",
          !streaming && "hover:bg-muted/60 hover:text-foreground",
          streaming && "cursor-default",
        )}
      >
        <Brain
          className={cn(
            "size-3.5 text-muted-foreground/70",
            streaming && "animate-(--animate-pulse-soft) text-primary/80",
          )}
        />
        <span>{header}</span>
        {!streaming && (
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground/60 transition-transform",
              effectiveOpen && "rotate-180",
            )}
          />
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
              {streaming && (
                <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-sm bg-muted-foreground/60 align-middle animate-(--animate-blink)" />
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
