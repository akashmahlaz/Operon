"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReasoningPart({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full rounded-xl border border-border bg-muted/30">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="text-xs text-muted-foreground">Reasoning</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
