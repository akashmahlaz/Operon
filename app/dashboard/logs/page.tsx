import { PageShell } from "@/components/dashboard/page-shell";
import { cn } from "@/lib/utils";

const logs = [
  { ts: "11:42:01", level: "info", source: "chat", message: "Stream completed (1.2s, 412 tokens)" },
  { ts: "11:41:58", level: "info", source: "tools.web_search", message: 'query="next.js 16 streaming"' },
  { ts: "11:41:55", level: "warn", source: "rate-limit", message: "minimax soft limit 80%, throttling" },
  { ts: "11:30:12", level: "error", source: "auth", message: "Google token refresh failed" },
];

const levelClass: Record<string, string> = {
  info: "text-foreground/70",
  warn: "text-amber-600",
  error: "text-destructive",
  debug: "text-muted-foreground",
};

export default function LogsPage() {
  return (
    <PageShell title="Logs" subtitle="Real-time tail of agent activity">
      <div className="overflow-hidden rounded-2xl border border-border bg-card font-mono text-xs">
        {logs.map((l, i) => (
          <div
            key={i}
            className="flex items-start gap-3 border-b border-border px-4 py-2 last:border-b-0"
          >
            <span className="text-muted-foreground/60">{l.ts}</span>
            <span
              className={cn(
                "uppercase",
                levelClass[l.level] ?? "text-foreground/70",
              )}
            >
              {l.level}
            </span>
            <span className="text-muted-foreground">{l.source}</span>
            <span className="flex-1">{l.message}</span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
