import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";

export interface MemoryFact extends Document {
  id: string;
  userId: string;
  content: string;
  source?: string;
  kind?: "preference" | "fact" | "project" | "instruction";
  importance?: number;
  normalizedContent?: string;
  /** Embedding vector for semantic recall — populated asynchronously. */
  embedding?: number[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

type MemoryFactInput = {
  content: string;
  source?: string;
  kind?: MemoryFact["kind"];
  importance?: number;
};

const memories = () => collections.memories<MemoryFact>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  // NOTE: MongoDB Stable API v1 (apiStrict:true) does NOT support legacy $text indexes.
  // We use regex search + in-app semantic ranking instead.
  indexesReady ??= Promise.all([
    memories().createIndex({ userId: 1, createdAt: -1 }),
    memories().createIndex({ userId: 1, updatedAt: -1 }),
    memories().createIndex({ userId: 1, normalizedContent: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

const SECRET_PATTERNS = [
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|bearer|password|passwd|secret|private[_-]?key)\b/i,
  /\b(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];

function normalizeContent(content: string) {
  return content.trim().replace(/\s+/g, " ").toLowerCase();
}

function assertSafeMemory(content: string) {
  if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new Error("Memory cannot store credentials, tokens, API keys, passwords, or private keys.");
  }
}

function clampImportance(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function compactMemoryLine(memoryFact: MemoryFact) {
  const kind = memoryFact.kind ? `${memoryFact.kind}: ` : "";
  return `- ${kind}${memoryFact.content}`;
}

// Score = importance(1-5) × recency decay (half-life 30 days).
// Higher = more relevant to include in prompt context.
function scoreMemory(fact: MemoryFact): number {
  const importance = fact.importance ?? 3;
  const ageMs = Date.now() - new Date(fact.updatedAt).getTime();
  const ageDays = ageMs / 86400_000;
  const recency = Math.exp(-ageDays / 30);
  // instructions and preferences score higher – they govern behavior
  const kindBoost = fact.kind === "instruction" || fact.kind === "preference" ? 1.3 : 1;
  return importance * recency * kindBoost;
}

const DEPTH_TO_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  forever: null,
};

async function purgeExpired(userId: string, depth: string | undefined) {
  if (!depth) return;
  const days = DEPTH_TO_DAYS[depth];
  if (days === undefined || days === null) return;
  const cutoff = new Date(Date.now() - days * 86400 * 1000).toISOString();
  await memories().deleteMany({
    userId,
    updatedAt: { $lt: cutoff },
    $or: [{ importance: { $exists: false } }, { importance: { $lt: 4 } }],
  });
}

export const memory = {
  async add(userId: string, fact: MemoryFactInput) {
    await ensureIndexes();
    const now = new Date().toISOString();
    const content = fact.content.trim();
    assertSafeMemory(content);
    const normalizedContent = normalizeContent(content);
    const entry: MemoryFact = {
      id: crypto.randomUUID(),
      userId,
      content,
      source: fact.source,
      kind: fact.kind,
      importance: clampImportance(fact.importance),
      normalizedContent,
      createdAt: now,
      updatedAt: now,
    };
    entry._id = entry.id;
    await memories().updateOne(
      { userId, normalizedContent },
      {
        $set: {
          content,
          source: fact.source,
          kind: fact.kind,
          importance: clampImportance(fact.importance),
          normalizedContent,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: entry.id,
          id: entry.id,
          userId,
          createdAt: now,
        },
      },
      { upsert: true },
    );
    // Generate embedding asynchronously — non-blocking, best-effort
    generateEmbedding(content).then((embedding: number[] | null) => {
      if (!embedding) return;
      memories().updateOne({ userId, normalizedContent }, { $set: { embedding } }).catch(() => {});
    }).catch(() => {});
    return memories().findOne({ userId, normalizedContent }) as Promise<MemoryFact>;
  },
  async search(userId: string, query: string, limit = 10) {
    await ensureIndexes();
    const q = query.toLowerCase().trim();
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Fetch wider candidate set then re-rank
    const candidates = await memories()
      .find({ userId, content: { $regex: safeQ, $options: "i" } })
      .sort({ importance: -1, updatedAt: -1 })
      .limit(50)
      .toArray();
    if (candidates.length === 0) return [];
    // Semantic re-rank if any candidates have embeddings
    const queryEmbedding = await generateEmbedding(query).catch(() => null);
    if (queryEmbedding && candidates.some((c) => c.embedding)) {
      candidates.sort((a, b) => {
        const simA = a.embedding ? cosineSimilarity(queryEmbedding, a.embedding) * (a.importance ?? 3) : 0;
        const simB = b.embedding ? cosineSimilarity(queryEmbedding, b.embedding) * (b.importance ?? 3) : 0;
        return simB - simA;
      });
    }
    return candidates.slice(0, limit);
  },
  async list(userId: string, limit = 50) {
    await ensureIndexes();
    return memories().find({ userId }).sort({ importance: -1, updatedAt: -1 }).limit(limit).toArray();
  },
  async remove(userId: string, id: string) {
    await ensureIndexes();
    await memories().deleteOne({ userId, id });
  },
  async purgeExpired(userId: string, depth: string | undefined) {
    await ensureIndexes();
    await purgeExpired(userId, depth);
  },
  async context(userId: string, query: string, limit = 8, options?: { depth?: string }) {
    await ensureIndexes();
    if (options?.depth) await purgeExpired(userId, options.depth);
    const [matched, recent] = await Promise.all([
      query.trim() ? memory.search(userId, query, limit) : Promise.resolve([]),
      memory.list(userId, Math.max(4, Math.floor(limit / 2))),
    ]);
    const byId = new Map<string, MemoryFact>();
    for (const entry of [...matched, ...recent]) {
      byId.set(entry.id, entry);
    }
    // Sort by composite score so highest-signal memories go first
    const sorted = [...byId.values()].sort((a, b) => scoreMemory(b) - scoreMemory(a));
    const selected = sorted.slice(0, limit);
    if (selected.length === 0) return "";
    const now = new Date().toISOString();
    await memories().updateMany(
      { userId, id: { $in: selected.map((entry) => entry.id) } },
      { $set: { lastUsedAt: now } },
    );
    return [
      "Known user memory. Use this as context, but do not reveal it unless relevant:",
      ...selected.map(compactMemoryLine),
    ].join("\n");
  },
};
