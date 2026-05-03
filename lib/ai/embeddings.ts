import { embed } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { resolveProviderKey } from "@/lib/services/auth-profiles";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

/** Returns an OpenAI-compatible embedding model for the user, or null if no key is configured. */
async function getEmbeddingModel(userId?: string) {
  const apiKey = await resolveProviderKey("openai", userId).catch(() => null);
  if (!apiKey) return null;
  return createOpenAI({ apiKey }).textEmbeddingModel(EMBEDDING_MODEL);
}

/** Generate a text embedding vector. Returns null if no embedding provider is configured. */
export async function generateEmbedding(text: string, userId?: string): Promise<number[] | null> {
  const model = await getEmbeddingModel(userId);
  if (!model) return null;
  const { embedding } = await embed({ model, value: text.slice(0, 8192) });
  return embedding;
}

/** Cosine similarity between two equal-length vectors. Returns 0 on bad input. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export { EMBEDDING_DIMS };
