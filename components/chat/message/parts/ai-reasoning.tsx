"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ReasoningPart({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-muted-foreground">
      <button
        onClick={() => setOpen(!open)}
        className="group/reasoning inline-flex items-center gap-1.5 text-[12px] italic leading-none text-muted-foreground/80 hover:text-muted-foreground"
      >
        <span className="text-primary/70">*</span>
        <span>Thinking</span>
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="mt-2 border-l border-border/70 pl-3 text-[12px] italic leading-relaxed text-muted-foreground/75 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}
