import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";

export interface StoredUserSettings extends Document {
  _id: string;
  userId: string;
  defaultModel?: string;
  createdAt: string;
  updatedAt: string;
}

const userSettings = () => collections.userSettings<StoredUserSettings>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= userSettings().createIndex({ userId: 1 }, { unique: true }).then(() => undefined);
  return indexesReady;
}

export async function getUserSettings(userId: string) {
  await ensureIndexes();
  return userSettings().findOne({ userId });
}

export async function setDefaultModel(userId: string, defaultModel: string) {
  await ensureIndexes();
  const now = new Date().toISOString();
  await userSettings().updateOne(
    { userId },
    {
      $set: { defaultModel, updatedAt: now },
      $setOnInsert: { _id: crypto.randomUUID(), userId, createdAt: now },
    },
    { upsert: true },
  );
  return userSettings().findOne({ userId });
}
