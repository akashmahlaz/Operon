/**
 * Two-phase confirmation for destructive tool calls.
 *
 * Pattern:
 *   1. The destructive tool builds a `PendingAction` describing exactly what
 *      will happen, stores it under a short token, and returns
 *      `{ requires_confirmation: true, token, summary, expiresAt }` to the
 *      model. The system prompt instructs the model to surface the summary
 *      verbatim and wait for explicit operator approval.
 *   2. The model calls `confirm_action({ token, approve: true })`. The pending
 *      action is looked up, validated against the same userId, and executed.
 *
 * Tokens live in MongoDB (collection `pending_confirmations`) so they survive
 * server restarts and are scoped per user. TTL = 10 minutes.
 */

import { randomBytes } from "node:crypto";
import { type Document } from "mongodb";
import { collections } from "@/lib/db-collections";

export interface PendingAction extends Document {
  _id: string;
  userId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  createdAt: string;
  expiresAt: Date;
}

const TTL_SECONDS = 60 * 10;
let indexEnsured: Promise<void> | null = null;

function collection() {
  return collections.collection<PendingAction>("pendingConfirmations");
}

async function ensureIndex() {
  if (!indexEnsured) {
    indexEnsured = (async () => {
      const col = collection();
      await col.createIndex({ userId: 1 });
      await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    })();
  }
  return indexEnsured;
}

export async function createPendingConfirmation(input: {
  userId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
}): Promise<{ token: string; expiresAt: string; requires_confirmation: true; summary: string }> {
  await ensureIndex();
  const token = randomBytes(12).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  const col = collection();
  await col.insertOne({
    _id: token,
    userId: input.userId,
    tool: input.tool,
    args: input.args,
    summary: input.summary,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return {
    requires_confirmation: true,
    token,
    summary: input.summary,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function consumePendingConfirmation(userId: string, token: string): Promise<PendingAction | null> {
  await ensureIndex();
  const col = collection();
  const doc = await col.findOneAndDelete({ _id: token, userId });
  if (!doc) return null;
  if (doc.expiresAt.getTime() < Date.now()) return null;
  return doc;
}
