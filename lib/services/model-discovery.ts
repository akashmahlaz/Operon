import { providerCatalog } from "@/components/dashboard/settings/provider-catalog";
import { resolveProviderKey } from "@/lib/services/auth-profiles";

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
}

const cache = new Map<string, { models: DiscoveredModel[]; createdAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const MODEL_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/models",
  openrouter: "https://openrouter.ai/api/v1/models",
  github: "https://models.inference.ai.azure.com/models",
  xai: "https://api.x.ai/v1/models",
  mistral: "https://api.mistral.ai/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  deepseek: "https://api.deepseek.com/models",
  perplexity: "https://api.perplexity.ai/models",
  together: "https://api.together.xyz/v1/models",
  fireworks: "https://api.fireworks.ai/inference/v1/models",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/models",
};

const STATIC_MODELS: Record<string, string[]> = Object.fromEntries(
  providerCatalog.map((provider) => [provider.id, provider.models || []]),
);

function appendPath(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function normalizeModelRows(providerId: string, rows: Array<{ id?: string; name?: string; displayName?: string }>) {
  return rows
    .map((row) => {
      const id = row.id || row.name?.replace(/^models\//, "");
      if (!id) return null;
      return { id, name: row.displayName || id, provider: providerId };
    })
    .filter((model): model is DiscoveredModel => Boolean(model));
}

async function fetchOpenAICompatible(providerId: string, endpoint: string, apiKey: string) {
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Model fetch failed for ${providerId}: ${response.status} ${text}`.trim());
  }
  const json = await response.json() as { data?: Array<{ id: string }>; models?: Array<{ name: string; displayName?: string }> };
  return normalizeModelRows(providerId, json.data || json.models || []);
}

async function fetchGoogleModels(apiKey: string) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Model fetch failed for google: ${response.status} ${text}`.trim());
  }
  const json = await response.json() as { models?: Array<{ name: string; displayName?: string }> };
  return normalizeModelRows("google", json.models || []).filter((model) => model.id.includes("gemini"));
}

function staticModels(providerId: string) {
  return (STATIC_MODELS[providerId] || []).map((id) => ({ id, name: id, provider: providerId }));
}

export async function discoverModels({
  providerId,
  userId,
  apiKey,
  baseUrl,
  force = false,
}: {
  providerId: string;
  userId?: string;
  apiKey?: string;
  baseUrl?: string;
  force?: boolean;
}) {
  const cacheKey = `${userId || "env"}:${providerId}:${baseUrl || ""}`;
  const cached = cache.get(cacheKey);
  if (!force && !apiKey && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.models;

  const key = apiKey || await resolveProviderKey(providerId, userId);
  if (!key) return staticModels(providerId);

  let models: DiscoveredModel[] = [];
  if (providerId === "google") {
    models = await fetchGoogleModels(key);
  } else if (providerId === "anthropic") {
    models = staticModels(providerId);
  } else {
    const endpoint = baseUrl ? appendPath(baseUrl, "models") : MODEL_ENDPOINTS[providerId];
    models = endpoint ? await fetchOpenAICompatible(providerId, endpoint, key) : staticModels(providerId);
  }

  if (models.length === 0) models = staticModels(providerId);
  if (!apiKey) cache.set(cacheKey, { models, createdAt: Date.now() });
  return models;
}

export function defaultModelFor(providerId: string, models: string[] = []) {
  const provider = providerCatalog.find((item) => item.id === providerId);
  return provider?.recommendedModel || models[0] || provider?.models?.[0] || "gpt-4.1";
}
