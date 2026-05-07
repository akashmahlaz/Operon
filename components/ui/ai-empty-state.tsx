"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AITextLoading } from "@/components/ui/ai-text-loading";
import { cn } from "@/lib/utils";

/**
 * Empty / loading state for list and search surfaces.
 * mode="loading" → cycling AI shimmer text
 * mode="empty"   → static icon + title + description + optional CTA
 */
export interface AIEmptyStateProps {
  mode?: "loading" | "empty";
  loadingTexts?: string[];
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function AIEmptyState({
  mode = "loading",
  loadingTexts = [
    "Scanning…",
    "Matching results…",
    "Ranking by relevance…",
    "Almost there…",
  ],
  title = "Nothing here yet",
  description = "Try a different filter or broaden your search.",
  action,
  className,
}: AIEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center",
        className
      )}
    >
      {mode === "loading" ? (
        <>
          <AITextLoading texts={loadingTexts} />
          <p className="mt-1 text-xs text-muted-foreground">
            This usually takes a moment.
          </p>
        </>
      ) : (
        <>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          {action ? <div className="mt-4">{action}</div> : null}
        </>
      )}
    </div>
  );
}
