import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";

export type WorkspaceFileKind = "bootstrap" | "soul" | "user";

export interface WorkspaceFile extends Document {
  id: string;
  userId: string;
  kind: WorkspaceFileKind;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const workspaceFiles = () => collections.workspaceFiles<WorkspaceFile>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    workspaceFiles().createIndex({ userId: 1, kind: 1 }, { unique: true }),
    workspaceFiles().createIndex({ userId: 1, updatedAt: -1 }),
  ]).then(() => undefined);
  return indexesReady;
}

export interface WorkspaceFilesSnapshot {
  bootstrap?: string;
  soul?: string;
  user?: string;
}

/**
 * Load all active workspace files for a user.
 * Missing files return undefined — callers decide how to handle absence.
 */
export async function getActiveWorkspaceFiles(
  userId: string,
): Promise<WorkspaceFilesSnapshot> {
  await ensureIndexes();
  const docs = await workspaceFiles()
    .find({ userId })
    .toArray();

  const result: WorkspaceFilesSnapshot = {};
  for (const doc of docs) {
    switch (doc.kind) {
      case "bootstrap": result.bootstrap = doc.content; break;
      case "soul":      result.soul      = doc.content; break;
      case "user":       result.user       = doc.content; break;
    }
  }
  return result;
}

/** Upsert a workspace file (one per user per kind) */
export async function saveWorkspaceFile(
  userId: string,
  kind: WorkspaceFileKind,
  content: string,
): Promise<WorkspaceFile> {
  await ensureIndexes();
  const now = new Date().toISOString();
  await workspaceFiles().updateOne(
    { userId, kind },
    {
      $set: { content, updatedAt: now },
      $setOnInsert: { _id: crypto.randomUUID(), id: crypto.randomUUID(), userId, kind, createdAt: now },
    },
    { upsert: true },
  );
  return workspaceFiles().findOne({ userId, kind }) as Promise<WorkspaceFile>;
}

/** Delete a workspace file */
export async function deleteWorkspaceFile(
  userId: string,
  kind: WorkspaceFileKind,
): Promise<void> {
  await ensureIndexes();
  await workspaceFiles().deleteOne({ userId, kind });
}

/** List all workspace files for a user (metadata only, no content for list view) */
export async function listWorkspaceFiles(userId: string) {
  await ensureIndexes();
  return workspaceFiles()
    .find({ userId })
    .project({ _id: 0, id: 1, kind: 1, updatedAt: 1 })
    .sort({ updatedAt: -1 })
    .toArray();
}

/**
 * Build the workspace files section for the system prompt.
 * Returns a formatted string to inject, or "" if no files exist.
 */
export function formatWorkspaceFilesSection(snapshot: WorkspaceFilesSnapshot): string {
  const parts: string[] = [];
  if (snapshot.bootstrap) {
    parts.push(
      "## BOOTSTRAP (operational rules — load first, apply always)\n" +
      snapshot.bootstrap.trim(),
    );
  }
  if (snapshot.soul) {
    parts.push(
      "## SOUL (personality & voice — shape how you communicate)\n" +
      snapshot.soul.trim(),
    );
  }
  if (snapshot.user) {
    parts.push(
      "## USER PROFILE (learned from interaction — always respect)\n" +
      snapshot.user.trim(),
    );
  }
  return parts.length > 0
    ? ["\n## Workspace Files\n", ...parts].join("\n")
    : "";
}