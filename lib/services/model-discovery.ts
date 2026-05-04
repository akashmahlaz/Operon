import { providerCatalog } from "@/components/dashboard/settings/provider-catalog";
import { resolveProviderKey } from "@/lib/services/auth-profiles";

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: string;
}

export type ModelDiscoverySource = "api" | "static" | "unavailable";

export interface ModelDiscoveryResult {
  models: DiscoveredModel[];
  source: ModelDiscoverySource;
}

const cache = new Map<string, { result: ModelDiscoveryResult; createdAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

const MODEL_ENDPOINTS: Record<string, string> = {
  minimax: "https://api.minimax.io/v1/models",
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

async function fetchAnthropicModels(apiKey: string) {
  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Model fetch failed for anthropic: ${response.status} ${text}`.trim());
  }
  const json = await response.json() as { data?: Array<{ id?: string; display_name?: string; displayName?: string }> };
  return normalizeModelRows(
    "anthropic",
    (json.data || []).map((model) => ({
      id: model.id,
      displayName: model.display_name || model.displayName,
    })),
  );
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
  const result = await discoverModelsWithSource({ providerId, userId, apiKey, baseUrl, force });
  return result.models;
}

export async function discoverModelsWithSource({
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
}): Promise<ModelDiscoveryResult> {
  const cacheKey = `${userId || "env"}:${providerId}:${baseUrl || ""}`;
  const cached = cache.get(cacheKey);
  if (!force && !apiKey && cached && Date.now() - cached.createdAt < CACHE_TTL_MS) return cached.result;

  const key = apiKey || await resolveProviderKey(providerId, userId);
  if (!key) return { models: staticModels(providerId), source: "static" };

  let models: DiscoveredModel[] = [];
  if (providerId === "google") {
    models = await fetchGoogleModels(key);
  } else if (providerId === "anthropic") {
    models = await fetchAnthropicModels(key);
  } else {
    const endpoint = baseUrl ? appendPath(baseUrl, "models") : MODEL_ENDPOINTS[providerId];
    if (!endpoint) return { models: [], source: "unavailable" };
    models = await fetchOpenAICompatible(providerId, endpoint, key);
  }

  const result: ModelDiscoveryResult = {
    models,
    source: models.length > 0 ? "api" : "unavailable",
  };
  if (!apiKey) cache.set(cacheKey, { result, createdAt: Date.now() });
  return result;
}

export function defaultModelFor(providerId: string, models: string[] = []) {
  const provider = providerCatalog.find((item) => item.id === providerId);
  if (models.length > 0) {
    return provider?.recommendedModel && models.includes(provider.recommendedModel)
      ? provider.recommendedModel
      : models[0];
  }
  return provider?.recommendedModel || provider?.models?.[0] || "gpt-4.1";
}
