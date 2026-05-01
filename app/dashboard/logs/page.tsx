"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const INITIAL_LOGS = [
  { ts: "11:42:01", level: "info" as const, source: "chat", message: "Stream completed (1.2s, 412 tokens)" },
  { ts: "11:41:58", level: "info" as const, source: "tools.web_search", message: 'query="next.js streaming"' },
  { ts: "11:41:55", level: "warn" as const, source: "rate-limit", message: "minimax soft limit 80%, throttling" },
  { ts: "11:30:12", level: "error" as const, source: "auth", message: "Token refresh failed" },
  { ts: "11:20:00", level: "info" as const, source: "agent", message: "Agent 'Marketing autopilot' triggered" },
  { ts: "11:15:33", level: "debug" as const, source: "scheduler", message: "Job 'daily-digest' completed" },
];

const LEVEL_COLORS: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-muted-foreground",
};

export default function LogsPage() {
  const [logs] = useState(INITIAL_LOGS);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Logs</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Real-time tail of agent activity
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="size-4" /> Live tail
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card font-mono text-xs">
          <div className="border-b border-border bg-muted/50 px-4 py-2 flex items-center gap-3">
            <ScrollText className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">system logs</span>
          </div>
          {logs.map((l, i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-border px-4 py-2 hover:bg-muted/30 transition-colors last:border-b-0"
            >
              <span className="text-muted-foreground/60 shrink-0">{l.ts}</span>
              <span
                className={cn(
                  "w-12 shrink-0 uppercase font-bold text-[10px]",
                  LEVEL_COLORS[l.level] ?? "text-foreground/70",
                )}
              >
                {l.level}
              </span>
              <span className="w-32 shrink-0 text-muted-foreground">{l.source}</span>
              <span className="flex-1 text-foreground/80">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
