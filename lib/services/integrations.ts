import { collections } from "@/lib/db-collections";
import { builtInIntegrations } from "@/lib/integrations";
import type { Integration } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredIntegration extends Document, Integration {
  _id: string;
  userId: string;
  credentials?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

const integrations = () => collections.integrations<StoredIntegration>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    integrations().createIndex({ userId: 1, slug: 1 }, { unique: true }),
    integrations().createIndex({ userId: 1, category: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

function mergeIntegration(baseIntegration: Integration, storedIntegration?: StoredIntegration): Integration {
  return storedIntegration
    ? { ...baseIntegration, id: storedIntegration.id || storedIntegration._id, connected: storedIntegration.connected }
    : baseIntegration;
}

export async function listIntegrations(userId: string) {
  await ensureIndexes();
  const storedIntegrations = await integrations().find({ userId }).toArray();
  const bySlug = new Map(storedIntegrations.map((integration) => [integration.slug, integration]));
  return builtInIntegrations.map((integration) => mergeIntegration(integration, bySlug.get(integration.slug)));
}

export async function upsertIntegration(userId: string, slug: string, patch: Partial<Pick<StoredIntegration, "connected" | "credentials">>) {
  await ensureIndexes();
  const baseIntegration = builtInIntegrations.find((integration) => integration.slug === slug);
  if (!baseIntegration) return null;

  const updatedAt = new Date().toISOString();
  await integrations().updateOne(
    { userId, slug },
    {
      $set: {
        ...baseIntegration,
        ...patch,
        updatedAt,
      },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        id: baseIntegration.id,
        userId,
        createdAt: updatedAt,
      },
    },
    { upsert: true },
  );

  return integrations().findOne({ userId, slug });
}
