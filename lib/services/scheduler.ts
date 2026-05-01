import { collections } from "@/lib/db-collections";
import type { ScheduledJob } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredScheduledJob extends Document, ScheduledJob {
  _id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

const jobs = () => collections.jobs<StoredScheduledJob>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    jobs().createIndex({ userId: 1, status: 1 }),
    jobs().createIndex({ userId: 1, nextRunAt: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

export async function listJobs(userId: string) {
  await ensureIndexes();
  return jobs().find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function createJob(userId: string, input: Omit<ScheduledJob, "id" | "status"> & { status?: ScheduledJob["status"] }) {
  await ensureIndexes();
  const createdAt = new Date().toISOString();
  const document: StoredScheduledJob = {
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    userId,
    description: input.description,
    cron: input.cron,
    lastRunAt: input.lastRunAt,
    nextRunAt: input.nextRunAt,
    status: input.status ?? "active",
    createdAt,
    updatedAt: createdAt,
  };
  document.id = document._id;
  await jobs().insertOne(document);
  return document;
}

export async function updateJob(userId: string, id: string, patch: Partial<Omit<ScheduledJob, "id">>) {
  await ensureIndexes();
  await jobs().updateOne({ userId, _id: id }, { $set: { ...patch, updatedAt: new Date().toISOString() } });
  return jobs().findOne({ userId, _id: id });
}

export async function deleteJob(userId: string, id: string) {
  await ensureIndexes();
  return jobs().deleteOne({ userId, _id: id });
}
