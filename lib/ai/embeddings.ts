import { resolveProviderKey, resolveProviderBaseUrl } from "@/lib/services/auth-profiles";

/** Supported embedding providers */
type EmbeddingProvider = "openai" | "gemini" | "ollama";

interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

const EMBEDDING_MODELS: Record<EmbeddingProvider, string> = {
  openai: "text-embedding-3-small",
  gemini: "text-embedding-004",
  ollama: "nomic-embed-text",
};

const EMBEDDING_DIMS: Record<EmbeddingProvider, number> = {
  openai: 1536,
  gemini: 768,
  ollama: 768,
};

/** Detect which embedding provider the user has configured — priority: OpenAI → Gemini → Ollama */
export async function resolveEmbeddingProvider(
  userId?: string,
): Promise<{ provider: EmbeddingProvider; apiKey: string; baseUrl?: string } | null> {
  for (const provider of ["openai", "gemini"] as EmbeddingProvider[]) {
    const key = await resolveProviderKey(provider, userId).catch(() => null);
    if (key) {
      const baseUrl = await resolveProviderBaseUrl(provider, userId);
      return { provider, apiKey: key, baseUrl: baseUrl || undefined };
    }
  }

  // Try Ollama (no API key needed, must be running locally)
  try {
    const ollamaBase =
      ((await resolveProviderBaseUrl("ollama", userId)) || "http://localhost:11434");
    const res = await fetch(`${ollamaBase}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return { provider: "ollama", apiKey: "", baseUrl: ollamaBase };
  } catch {
    // Ollama not available
  }

  return null;
}

/** Embed a single text string */
export async function embedText(
  text: string,
  userId?: string,
): Promise<EmbeddingResult | null> {
  const resolved = await resolveEmbeddingProvider(userId);
  if (!resolved) return null;

  const { provider, apiKey, baseUrl } = resolved;

  switch (provider) {
    case "openai":
      return embedOpenAI(text, apiKey, baseUrl);
    case "gemini":
      return embedGemini(text, apiKey);
    case "ollama":
      return embedOllama(text, baseUrl || "http://localhost:11434");
  }
}

/** Embed multiple texts in a batch */
export async function embedBatch(
  texts: string[],
  userId?: string,
): Promise<(EmbeddingResult | null)[]> {
  const resolved = await resolveEmbeddingProvider(userId);
  if (!resolved) return texts.map(() => null);

  const { provider, apiKey, baseUrl } = resolved;

  if (provider === "openai") {
    return embedOpenAIBatch(texts, apiKey, baseUrl);
  }

  // Fallback: embed one at a time
  const results: (EmbeddingResult | null)[] = [];
  for (const text of texts) {
    switch (provider) {
      case "gemini":
        results.push(await embedGemini(text, apiKey));
        break;
      case "ollama":
        results.push(await embedOllama(text, baseUrl || "http://localhost:11434"));
        break;
    }
  }
  return results;
}

/** Get embedding dimensions for the current provider */
export function getEmbeddingDims(provider: EmbeddingProvider): number {
  return EMBEDDING_DIMS[provider];
}

export { EMBEDDING_DIMS, EMBEDDING_MODELS };

// --- Provider implementations ---

async function embedOpenAI(
  text: string,
  apiKey: string,
  baseUrl?: string,
): Promise<EmbeddingResult | null> {
  try {
    const url = `${baseUrl || "https://api.openai.com/v1"}/embeddings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODELS.openai,
        input: text,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      embedding: data.data[0].embedding,
      tokenCount: data.usage?.total_tokens ?? Math.ceil(text.length / 4),
    };
  } catch {
    return null;
  }
}

async function embedOpenAIBatch(
  texts: string[],
  apiKey: string,
  baseUrl?: string,
): Promise<(EmbeddingResult | null)[]> {
  try {
    const url = `${baseUrl || "https://api.openai.com/v1"}/embeddings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODELS.openai,
        input: texts,
      }),
    });
    if (!res.ok) return texts.map(() => null);
    const data = await res.json();
    return data.data.map(
      (item: { embedding: number[] }, i: number) => ({
        embedding: item.embedding,
        tokenCount: Math.ceil((texts[i]?.length ?? 0) / 4),
      }),
    );
  } catch {
    return texts.map(() => null);
  }
}

async function embedGemini(text: string, apiKey: string): Promise<EmbeddingResult | null> {
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODELS.gemini}:embedText?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      embedding: data.embedding?.values ?? [],
      tokenCount: Math.ceil(text.length / 4),
    };
  } catch {
    return null;
  }
}

async function embedOllama(text: string, baseUrl: string): Promise<EmbeddingResult | null> {
  try {
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODELS.ollama,
        prompt: text,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      embedding: data.embedding ?? [],
      tokenCount: Math.ceil(text.length / 4),
    };
  } catch {
    return null;
  }
}

/** Cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}
