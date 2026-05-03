import { minimax } from "vercel-minimax-ai-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { getUserSettings } from "@/lib/services/user-settings";
import { resolveProviderBaseUrl, resolveProviderKey } from "@/lib/services/auth-profiles";
import { defaultModelFor } from "@/lib/services/model-discovery";

export const DEFAULT_CHAT_MODEL = "MiniMax-M2.7";

const OPENAI_COMPATIBLE_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  github: "https://models.inference.ai.azure.com",
  xai: "https://api.x.ai/v1",
  mistral: "https://api.mistral.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  deepseek: "https://api.deepseek.com",
  perplexity: "https://api.perplexity.ai",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export async function getChatModel(userId?: string, modelSpec?: string, personaModel?: string) {
  const settings = userId ? await getUserSettings(userId) : null;
  // Priority: explicit modelSpec > persona model override > user defaultModel > global default
  const spec = modelSpec || personaModel || settings?.defaultModel || `minimax/${DEFAULT_CHAT_MODEL}`;
  const slashIndex = spec.indexOf("/");
  const [providerId, rawModelId] = slashIndex >= 0
    ? [spec.slice(0, slashIndex), spec.slice(slashIndex + 1)]
    : ["minimax", spec];
  const modelId = rawModelId || defaultModelFor(providerId);

  if (providerId === "minimax") return minimax(modelId || DEFAULT_CHAT_MODEL);

  const apiKey = await resolveProviderKey(providerId, userId);
  if (!apiKey) return minimax(DEFAULT_CHAT_MODEL);

  const baseURL = await resolveProviderBaseUrl(providerId, userId) || OPENAI_COMPATIBLE_BASE_URLS[providerId];
  if (!baseURL) return minimax(DEFAULT_CHAT_MODEL);

  return createOpenAI({ apiKey, baseURL, name: providerId })(modelId);
}
