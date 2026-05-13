"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollText, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operonFetch } from "@/lib/operon-api";
import { toast } from "sonner";
import Link from "next/link";

interface RunLog {
  runId: string;
  conversationId: string;
  status: "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";
  model: string;
  requestId: string | null;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<RunLog["status"], string> = {
  queued: "text-muted-foreground",
  running: "text-blue-400",
  paused: "text-yellow-400",
  completed: "text-emerald-400",
  failed: "text-red-400",
  cancelled: "text-muted-foreground",
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 1000)}s`;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await operonFetch("/admin/logs");
      const data = await res.json();
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 10_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Logs</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Recent agent runs · auto-refreshes every 10s
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card font-mono text-xs">
          <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2">
            <ScrollText className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">runs</span>
            <span className="ml-auto text-muted-foreground/70">{logs.length}</span>
          </div>
          {loading && logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No runs yet. Start a chat to see runs appear here.
            </div>
          ) : (
            logs.map((l) => (
              <div
                key={l.runId}
                className="flex items-start gap-3 border-b border-border px-4 py-2 transition-colors last:border-b-0 hover:bg-muted/30"
              >
                <span className="w-20 shrink-0 text-muted-foreground/60">
                  {formatTime(l.createdAt)}
                </span>
                <span
                  className={cn(
                    "w-20 shrink-0 text-[10px] font-bold uppercase",
                    STATUS_COLORS[l.status] ?? "text-foreground/70",
                  )}
                >
                  {l.status}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/chat?id=${l.conversationId}`}
                      className="truncate text-foreground/80 hover:underline"
                      title={l.model}
                    >
                      {l.model}
                    </Link>
                    {formatDuration(l.startedAt, l.completedAt) && (
                      <span className="text-muted-foreground/70">
                        · {formatDuration(l.startedAt, l.completedAt)}
                      </span>
                    )}
                  </div>
                  {l.requestId && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(l.requestId ?? "");
                        toast.success("Request id copied");
                      }}
                      className="group flex w-fit items-center gap-1.5 text-[10px] text-muted-foreground/70 hover:text-foreground"
                      title="Click to copy provider request id"
                    >
                      <span className="font-mono">req: {l.requestId}</span>
                      <Copy className="size-2.5 opacity-0 group-hover:opacity-100" />
                    </button>
                  )}
                  {l.lastError && (
                    <span className="break-words text-[10.5px] text-destructive/80">
                      {l.lastError}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
