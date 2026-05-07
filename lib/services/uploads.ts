import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";

export interface StoredUpload extends Document {
  _id: string;
  userId: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  createdAt: string;
}

export type NewUpload = Pick<StoredUpload, "userId" | "filename" | "contentType" | "size" | "url">;

const uploads = () => collections.uploads<StoredUpload>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    uploads().createIndex({ userId: 1, createdAt: -1 }),
    uploads().createIndex({ url: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

export async function recordUpload(input: NewUpload) {
  await ensureIndexes();
  const document: StoredUpload = {
    _id: crypto.randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };
  await uploads().insertOne(document);
  return document;
}

export async function listUploads(userId: string, limit = 100) {
  await ensureIndexes();
  return uploads().find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}
