import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";

/**
 * Agent skills — Hermes-style procedural memory.
 *
 * A "skill" is a named, re-runnable recipe consisting of:
 *  - a human description ("Deploy a Next.js app to Vercel with Supabase auth"),
 *  - a sequence of tool invocations the agent should follow,
 *  - tag/keyword metadata so the planner can recall it from a natural-language hint,
 *  - usage stats so we can promote successful recipes and demote failing ones.
 *
 * Skills are stored per-user (privacy default). Sharing happens later via an
 * opt-in `share_slug`. The agent recalls skills by similarity and presents the
 * best candidate before executing the steps.
 */

export interface AgentSkillStep {
  /** Tool name to call, e.g. "github_create_branch". */
  tool: string;
  /** JSON-serialisable arguments. May include placeholders like `{{owner}}`. */
  args: Record<string, unknown>;
  /** Optional human note describing what this step accomplishes. */
  note?: string;
}

export interface AgentSkill {
  id: string;
  userId: string;
  name: string;
  description: string;
  tags: string[];
  steps: AgentSkillStep[];
  /** Comma-free hint string the planner can use during recall. */
  trigger: string;
  invocationCount: number;
  successCount: number;
  failureCount: number;
  lastUsedAt: string | null;
  shareSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredAgentSkill extends Document, AgentSkill {
  _id: string;
}

const skills = () => collections.agentSkills<StoredAgentSkill>();

let indexesReady: Promise<void> | null = null;
function ensureIndexes() {
  indexesReady ??= Promise.all([
    skills().createIndex({ userId: 1, name: 1 }, { unique: true }),
    skills().createIndex({ userId: 1, tags: 1 }),
    skills().createIndex({ shareSlug: 1 }, { unique: true, sparse: true }),
  ]).then(() => undefined);
  return indexesReady;
}

function newId() {
  return crypto.randomUUID();
}

export async function listAgentSkills(userId: string): Promise<AgentSkill[]> {
  await ensureIndexes();
  const docs = await skills().find({ userId }).sort({ updatedAt: -1 }).limit(200).toArray();
  return docs.map(stripStored);
}

export async function searchAgentSkills(userId: string, query: string, limit = 8): Promise<AgentSkill[]> {
  await ensureIndexes();
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return listAgentSkills(userId);
  const regex = new RegExp(tokens.map(escapeRegex).join("|"), "i");
  const docs = await skills()
    .find({
      userId,
      $or: [{ name: regex }, { description: regex }, { trigger: regex }, { tags: { $in: tokens } }],
    })
    .sort({ invocationCount: -1, updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(stripStored);
}

export async function saveAgentSkill(
  userId: string,
  input: {
    name: string;
    description: string;
    steps: AgentSkillStep[];
    tags?: string[];
    trigger?: string;
  },
): Promise<AgentSkill> {
  await ensureIndexes();
  const now = new Date().toISOString();
  const existing = await skills().findOne({ userId, name: input.name });
  if (existing) {
    const updated: AgentSkill = {
      ...stripStored(existing),
      description: input.description,
      steps: input.steps,
      tags: input.tags ?? existing.tags ?? [],
      trigger: input.trigger ?? existing.trigger ?? input.description,
      updatedAt: now,
    };
    await skills().updateOne({ _id: existing._id }, { $set: updated });
    return updated;
  }
  const doc: StoredAgentSkill = {
    _id: newId(),
    id: newId(),
    userId,
    name: input.name,
    description: input.description,
    tags: input.tags ?? [],
    steps: input.steps,
    trigger: input.trigger ?? input.description,
    invocationCount: 0,
    successCount: 0,
    failureCount: 0,
    lastUsedAt: null,
    shareSlug: null,
    createdAt: now,
    updatedAt: now,
  };
  await skills().insertOne(doc);
  return stripStored(doc);
}

export async function recordAgentSkillRun(
  userId: string,
  name: string,
  outcome: "success" | "failure",
): Promise<void> {
  await ensureIndexes();
  const inc =
    outcome === "success"
      ? { invocationCount: 1, successCount: 1 }
      : { invocationCount: 1, failureCount: 1 };
  await skills().updateOne(
    { userId, name },
    { $inc: inc, $set: { lastUsedAt: new Date().toISOString() } },
  );
}

export async function deleteAgentSkill(userId: string, name: string): Promise<boolean> {
  await ensureIndexes();
  const result = await skills().deleteOne({ userId, name });
  return result.deletedCount === 1;
}

function stripStored(doc: StoredAgentSkill): AgentSkill {
  const { _id: _ignored, ...rest } = doc;
  void _ignored;
  return rest;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
