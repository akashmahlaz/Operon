import { collections } from "@/lib/db-collections";
import type { LogEntry } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredLogEntry extends Document, LogEntry {
  _id: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

const logs = () => collections.logs<StoredLogEntry>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    logs().createIndex({ createdAt: -1 }),
    logs().createIndex({ userId: 1, createdAt: -1 }),
    logs().createIndex({ source: 1, createdAt: -1 }),
  ]).then(() => undefined);
  return indexesReady;
}

export async function appendLog(entry: Omit<LogEntry, "id" | "createdAt"> & { userId?: string; metadata?: Record<string, unknown> }) {
  await ensureIndexes();
  const createdAt = new Date().toISOString();
  const document: StoredLogEntry = {
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    level: entry.level,
    source: entry.source,
    message: entry.message,
    userId: entry.userId,
    metadata: entry.metadata,
    createdAt,
  };
  document.id = document._id;
  await logs().insertOne(document);
  return document;
}

export async function listLogs({ userId, limit = 100 }: { userId?: string; limit?: number } = {}) {
  await ensureIndexes();
  const query = userId ? { userId } : {};
  return logs().find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}
