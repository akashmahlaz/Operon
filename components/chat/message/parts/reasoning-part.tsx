"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReasoningPartProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function ReasoningPart({ text, streaming, className }: ReasoningPartProps) {
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (streaming) setOpen(true);
  }, [streaming, text]);

  useEffect(() => {
    if (!streaming) return;
    startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [streaming]);

  if (!text && !streaming) return null;

  const header = streaming
    ? `Thinking${elapsed > 0 ? ` ${elapsed}s` : "..."}`
    : `Thought${elapsed > 0 ? ` for ${elapsed}s` : ""}`;

  return (
    <div className={cn("text-muted-foreground", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="group/reasoning inline-flex items-center gap-1.5 text-[12px] italic leading-none text-muted-foreground/80 hover:text-muted-foreground"
      >
        <span className="text-primary/70">*</span>
        <span>{header}</span>
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
      </button>

      <div className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
        open ? "max-h-96" : "max-h-0",
      )}>
        <div className="mt-2 border-l border-border/70 pl-3">
          <p className="whitespace-pre-wrap text-[12px] italic leading-relaxed text-muted-foreground/75">
            {text}
            {streaming && (
              <span className="ml-0.5 inline-block w-px h-3 bg-muted-foreground/60 align-middle animate-(--animate-blink)" />
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
