import { collections } from "@/lib/db-collections";
import type { Agent } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredAgent extends Document, Agent {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const agents = () => collections.agents<StoredAgent>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    agents().createIndex({ userId: 1, createdAt: -1 }),
    agents().createIndex({ userId: 1, enabled: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

export async function listAgents(userId: string) {
  await ensureIndexes();
  return agents().find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function createAgent(userId: string, input: Omit<Agent, "id">) {
  await ensureIndexes();
  const createdAt = new Date().toISOString();
  const document: StoredAgent = {
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    userId,
    ...input,
    createdAt,
    updatedAt: createdAt,
  };
  document.id = document._id;
  await agents().insertOne(document);
  return document;
}

export async function updateAgent(userId: string, id: string, patch: Partial<Omit<Agent, "id">>) {
  await ensureIndexes();
  await agents().updateOne({ userId, _id: id }, { $set: { ...patch, updatedAt: new Date().toISOString() } });
  return agents().findOne({ userId, _id: id });
}

export async function deleteAgent(userId: string, id: string) {
  await ensureIndexes();
  return agents().deleteOne({ userId, _id: id });
}
