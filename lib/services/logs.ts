import { operonServerJson } from "@/lib/server-operon-api";
import type { LogEntry } from "@/lib/types";

export interface StoredLogEntry extends LogEntry {
  userId?: string;
  metadata?: Record<string, unknown>;
}

interface RustLogEntry {
  id: string;
  userId?: string;
  level: LogEntry["level"];
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function fromRustLog(row: RustLogEntry): StoredLogEntry {
  return {
    id: row.id,
    level: row.level,
    source: row.source,
    message: row.message,
    userId: row.userId,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

export async function appendLog(
  entry: Omit<LogEntry, "id" | "createdAt"> & { userId?: string; metadata?: Record<string, unknown> },
) {
  const row = await operonServerJson<RustLogEntry>("/logs", {
    method: "POST",
    body: JSON.stringify(entry),
  });
  return fromRustLog(row);
}

export async function listLogs({ userId, limit = 100 }: { userId?: string; limit?: number } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (userId) params.set("userId", userId);
  const rows = await operonServerJson<RustLogEntry[]>(`/logs?${params}`);
  return rows.map(fromRustLog);
}
