"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Mouse-tracked spotlight stat card with tone variants.
 * Adapted from justbecuase. Use for dashboard KPIs.
 *
 * `icon` is `ReactNode` so callers can render lucide icons directly without
 * crossing a non-serializable function-prop boundary in RSC.
 */
export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "primary" | "amber" | "emerald" | "blue" | "violet" | "rose" | "sky" | "teal" | "coral";
  badge?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const TONE_BG: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  teal: "bg-teal/10 text-teal",
  coral: "bg-coral/10 text-coral",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
};

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  badge,
  className,
  onClick,
}: StatCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--my", `${e.clientY - rect.top}px`);
    },
    []
  );

  return (
    <Card
      ref={ref}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden transition-all duration-300",
        "hover:border-primary/30 hover:shadow-md",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(280px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--primary) 12%, transparent), transparent 60%)",
        }}
      />

      <CardContent className="relative p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
              TONE_BG[tone]
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {label}
              {hint ? <span className="ml-1 opacity-70">· {hint}</span> : null}
            </p>
          </div>
          {badge ? (
            typeof badge === "string" || typeof badge === "number" ? (
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                {badge}
              </Badge>
            ) : (
              <div className="shrink-0">{badge}</div>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
