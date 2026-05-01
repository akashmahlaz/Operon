"use client";

import { useState } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReasoningPart({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
      >
        <Brain className="h-3.5 w-3.5 text-foreground/50" />
        <span className="text-xs font-medium text-foreground/60">Thinking</span>
        <ChevronRight
          className={cn(
            "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 py-3 text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap bg-muted/10">
          {text}
        </div>
      )}
    </div>
  );
}
