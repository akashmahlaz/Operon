import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";
import { embedText, embedBatch, cosineSimilarity } from "@/lib/ai/embeddings";

export interface MemoryFact extends Document {
  id: string;
  userId: string;
  content: string;
  source?: string;
  kind?: "preference" | "fact" | "project" | "instruction";
  importance?: number;
  normalizedContent?: string;
  /** Embedding vector for semantic recall */
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

// ─── BM25 / Keyword helpers ───────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","a","an","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","will","would","could","should","may","might","shall","can",
  "to","of","in","for","on","with","at","by","from","as","into","about","like",
  "through","after","over","between","out","up","down","off","then","than","so",
  "no","not","only","own","same","but","and","or","nor","if","this","that","these",
  "those","it","its","my","your","his","her","our","their","i","you","he","she",
  "we","they","me","him","us","them","what","which","who","when","where","how",
  "all","each","every","both","few","more","most","other","some","such","just",
  "also","very",
]);

/** Extract BM25-friendly keywords from text */
function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 50);
}

// ─── Chunking ────────────────────────────────────────────────────────────────

const CHUNK_SIZE_TOKENS = 400;
const CHUNK_OVERLAP_TOKENS = 80;

/** Estimate token count (~4 chars per token) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Split text into overlapping chunks of ~400 tokens with 80-token overlap */
function chunkText(text: string): Array<{
  text: string;
  tokenCount: number;
  keywords: string[];
}> {
  const lines = text.split("\n");
  const chunks: Array<{ text: string; tokenCount: number; keywords: string[] }> = [];

  let currentLines: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokens(line);
    currentLines.push(line);
    currentTokens += lineTokens;

    if (currentTokens >= CHUNK_SIZE_TOKENS || line === lines[lines.length - 1]) {
      const chunkText = currentLines.join("\n");
      chunks.push({
        text: chunkText,
        tokenCount: currentTokens,
        keywords: extractKeywords(chunkText),
      });

      // Build overlapping tail
      let overlapTokens = 0;
      let overlapStart = currentLines.length;
      for (let j = currentLines.length - 1; j >= 0; j--) {
        overlapTokens += estimateTokens(currentLines[j]);
        if (overlapTokens >= CHUNK_OVERLAP_TOKENS) {
          overlapStart = j;
          break;
        }
      }
      currentLines = currentLines.slice(overlapStart);
      currentTokens = currentLines.reduce(
        (acc, l) => acc + estimateTokens(l),
        0,
      );
    }
  }

  return chunks;
}

// ─── Cosine similarity (local) ───────────────────────────────────────────────

function cosineSim(a: number[], b: number[]): number {
  return cosineSimilarity(a, b);
}

// ─── Indexes ─────────────────────────────────────────────────────────────────

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    memories().createIndex({ userId: 1, createdAt: -1 }),
    memories().createIndex({ userId: 1, updatedAt: -1 }),
    memories().createIndex({ userId: 1, normalizedContent: 1 }),
  ]).then(() => undefined);
  return indexesReady;
}

// ─── Secret guard ─────────────────────────────────────────────────────────────

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

// ─── Formatting ───────────────────────────────────────────────────────────────

export function compactMemoryLine(memoryFact: MemoryFact) {
  const kind = memoryFact.kind ? `${memoryFact.kind}: ` : "";
  return `- ${kind}${memoryFact.content}`;
}

// Score = importance(1-5) × recency decay (half-life 30 days).
function scoreMemory(fact: MemoryFact): number {
  const importance = fact.importance ?? 3;
  const ageMs = Date.now() - new Date(fact.updatedAt).getTime();
  const ageDays = ageMs / 86400_000;
  const recency = Math.exp(-ageDays / 30);
  const kindBoost = fact.kind === "instruction" || fact.kind === "preference" ? 1.3 : 1;
  return importance * recency * kindBoost;
}

// ─── Purge ───────────────────────────────────────────────────────────────────

const DEPTH_TO_DAYS: Record<string, number | null> = {
  "7d": 7, "30d": 30, "90d": 90, forever: null,
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

// ─── Memory store (MemoryFact — single-doc per fact, not chunked) ─────────────

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
    embedText(content, userId).then((result) => {
      if (!result) return;
      memories().updateOne(
        { userId, normalizedContent },
        { $set: { embedding: result.embedding } },
      ).catch(() => {});
    }).catch(() => {});
    return memories().findOne({ userId, normalizedContent }) as Promise<MemoryFact>;
  },

  async search(userId: string, query: string, limit = 10) {
    await ensureIndexes();
    const q = query.toLowerCase().trim();
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const candidates = await memories()
      .find({ userId, content: { $regex: safeQ, $options: "i" } })
      .sort({ importance: -1, updatedAt: -1 })
      .limit(50)
      .toArray();
    if (candidates.length === 0) return [];

    const queryEmbedding = await embedText(query, userId).catch(() => null);
    if (queryEmbedding && candidates.some((c) => c.embedding)) {
      candidates.sort((a, b) => {
        const simA = a.embedding ? cosineSim(queryEmbedding.embedding, a.embedding) * (a.importance ?? 3) : 0;
        const simB = b.embedding ? cosineSim(queryEmbedding.embedding, b.embedding) * (b.importance ?? 3) : 0;
        return simB - simA;
      });
    }

    // Update lastUsedAt for accessed facts
    void memories().updateMany(
      { userId, id: { $in: candidates.slice(0, limit).map((c) => c.id) } },
      { $set: { lastUsedAt: new Date().toISOString() } },
    ).catch(() => {});

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
    const sorted = [...byId.values()].sort((a, b) => scoreMemory(b) - scoreMemory(a));
    const selected = sorted.slice(0, limit);
    if (selected.length === 0) return "";

    const now = new Date().toISOString();
    await memories().updateMany(
      { userId, id: { $in: selected.map((entry) => entry.id) } },
      { $set: { lastUsedAt: now } },
    );

    return [
      "Known user memory (use as context, don't reveal unless relevant):",
      ...selected.map(compactMemoryLine),
    ].join("\n");
  },

  /**
   * Index a long text into memory chunks — for conversation transcripts,
   * workspace files, and other long-form content. Each chunk gets its own
   * embedding for hybrid vector + BM25 search.
   */
  async indexChunked(
    userId: string,
    source: "conversation" | "workspace" | "note",
    sourceId: string,
    text: string,
  ): Promise<number> {
    await ensureIndexes();
    const chunks = chunkText(text);
    if (chunks.length === 0) return 0;

    // Embed in batch for efficiency
    const embeddings = await embedBatch(
      chunks.map((c) => c.text),
      userId,
    );

    const docs = chunks.map((chunk, i) => ({
      userId,
      source,
      sourceId,
      content: chunk.text,
      tokenCount: chunk.tokenCount,
      keywords: chunk.keywords,
      embedding: (embeddings[i] as { embedding?: number[] } | null)?.embedding ?? [],
    }));

    // Upsert into memories collection using composite key to avoid duplicates
    await Promise.all(
      docs.map((doc) =>
        memories().updateOne(
          { userId, source, sourceId, content: doc.content },
          { $set: { ...doc, updatedAt: new Date().toISOString() } },
          { upsert: true },
        ),
      ),
    );

    return docs.length;
  },

  /**
   * Hybrid search: vector similarity + BM25 keyword matching, merged with weighted scoring.
   * Brilion's pattern — used for long content that was indexed via indexChunked().
   */
  async hybridSearch(
    userId: string,
    query: string,
    options: {
      sources?: string[];
      topK?: number;
      minScore?: number;
      vectorWeight?: number;
      textWeight?: number;
    } = {},
  ): Promise<Array<{ content: string; source: string; sourceId: string; score: number }>> {
    await ensureIndexes();
    const {
      sources,
      topK = 6,
      minScore = 0.3,
      vectorWeight = 0.7,
      textWeight = 0.3,
    } = options;

    const filter: Record<string, unknown> = { userId };
    if (sources && sources.length > 0) {
      filter.source = { $in: sources };
    }

    // Vector search
    const queryEmbedding = await embedText(query, userId).catch(() => null);
    let vectorResults: Array<{ content: string; source: string; sourceId: string; score: number }> = [];

    if (queryEmbedding && queryEmbedding.embedding.length > 0) {
      const candidates = await memories()
        .find({ ...filter, "embedding.0": { $exists: true } })
        .project({ content: 1, source: 1, sourceId: 1, embedding: 1 })
        .limit(200)
        .toArray();

      vectorResults = (candidates as (MemoryFact & { embedding?: number[] })[])
        .map((doc) => ({
          content: doc.content,
          source: doc.source ?? "unknown",
          sourceId: doc.sourceId ?? "",
          score: cosineSim(queryEmbedding.embedding, doc.embedding ?? []),
        }))
        .filter((r) => r.score > 0.1)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 2);
    }

    // Text/BM25 search via regex keyword match (MongoDB text index unavailable under Stable API)
    const queryKeywords = extractKeywords(query);
    let textResults: Array<{ content: string; source: string; sourceId: string; score: number }> = [];

    if (queryKeywords.length > 0) {
      const textCandidates = await memories()
        .find({
          ...filter,
          keywords: { $all: queryKeywords.slice(0, 5) },
        })
        .project({ content: 1, source: 1, sourceId: 1 })
        .limit(topK * 2)
        .toArray();

      textResults = (textCandidates as MemoryFact[])
        .map((doc) => {
          // Count how many query keywords appear in the content
          const matched = queryKeywords.filter((k) =>
            (doc.content ?? "").toLowerCase().includes(k),
          ).length;
          return {
            content: doc.content ?? doc.content ?? "",
            source: doc.source ?? "unknown",
            sourceId: doc.sourceId ?? "",
            score: matched / queryKeywords.length,
          };
        })
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK * 2);
    }

    // Merge with weighted hybrid scoring
    const merged = new Map<string, { content: string; source: string; sourceId: string; score: number }>();

    for (const r of vectorResults) {
      const key = `${r.source}:${r.sourceId}:${r.content.slice(0, 50)}`;
      merged.set(key, { ...r, score: r.score * vectorWeight });
    }

    for (const r of textResults) {
      const key = `${r.source}:${r.sourceId}:${r.content.slice(0, 50)}`;
      const existing = merged.get(key);
      if (existing) {
        existing.score += r.score * textWeight;
      } else {
        merged.set(key, { ...r, score: r.score * textWeight });
      }
    }

    return Array.from(merged.values())
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  },
};
