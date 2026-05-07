export type ProviderKind = "recommended" | "model" | "gateway" | "integration";
export type ProviderSetup = "api-key" | "oauth";

export interface ProviderMeta {
  id: string;
  name: string;
  description: string;
  website: string;
  configured: boolean;
  defaultBaseUrl?: string;
  kind: ProviderKind;
  badge?: string;
  setup: ProviderSetup;
  shortDescription: string;
  recommendedModel?: string;
  tokenRef?: string;
  updatedAt?: string;
  models?: string[];
  /** True when models array came from a live API discovery (profile or env-key). False = static catalog placeholders. */
  modelsFromProfile?: boolean;
  modelsSource?: "api" | "profile" | "static" | "unavailable";
}

export const recommendedProviderIds = ["github-copilot", "openai", "anthropic", "openrouter"];

export const providerCatalog: ProviderMeta[] = [
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    description: "Use models available through your Copilot subscription.",
    website: "https://github.com/login/device",
    configured: false,
    kind: "recommended",
    badge: "Recommended",
    setup: "oauth",
    shortDescription: "Use models available through your Copilot subscription.",
    recommendedModel: "gpt-4.1",
    models: ["gpt-4.1", "gpt-4o", "claude-sonnet-4", "gemini-2.5-pro"],
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax text and multimodal models.",
    website: "https://www.minimax.io/platform",
    configured: true,
    kind: "model",
    badge: "Current",
    setup: "api-key",
    shortDescription: "MiniMax text and multimodal models.",
    recommendedModel: "MiniMax-M2.1",
    tokenRef: "env:MINIMAX_API_KEY",
    updatedAt: "2026-05-01T00:00:00.000Z",
    models: ["MiniMax-M2.1", "MiniMax-M2", "MiniMax-M2.1-lightning"],
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT, o-series, realtime, and general purpose models.",
    website: "https://platform.openai.com/api-keys",
    configured: false,
    kind: "recommended",
    badge: "Most common",
    setup: "api-key",
    shortDescription: "GPT, o-series, realtime, and general purpose models.",
    recommendedModel: "gpt-4.1",
    models: ["gpt-4.1", "gpt-4o", "o4-mini", "gpt-4.1-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models for reasoning, writing, and agents.",
    website: "https://console.anthropic.com/settings/keys",
    configured: false,
    kind: "recommended",
    badge: "Claude",
    setup: "api-key",
    shortDescription: "Claude models for reasoning, writing, and agents.",
    recommendedModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One key for many providers including Qwen, DeepSeek, Claude, and Llama.",
    website: "https://openrouter.ai/keys",
    configured: false,
    kind: "gateway",
    badge: "200+ models",
    setup: "api-key",
    shortDescription: "One key for many providers including Qwen, DeepSeek, Claude, and Llama.",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: ["openai/gpt-4.1", "anthropic/claude-sonnet-4", "qwen/qwen3-235b-a22b"],
  },
  {
    id: "github",
    name: "GitHub Models",
    description: "GitHub Models Marketplace via Azure AI inference.",
    website: "https://github.com/settings/tokens",
    configured: false,
    kind: "gateway",
    badge: "Marketplace",
    setup: "api-key",
    shortDescription: "GitHub Models Marketplace via the Azure AI inference endpoint.",
    defaultBaseUrl: "https://models.inference.ai.azure.com",
  },
  {
    id: "github-code",
    name: "GitHub Code Access",
    description: "Fine-grained GitHub token for repository search, pull requests, and code-editing tools.",
    website: "https://github.com/settings/personal-access-tokens/new",
    configured: false,
    kind: "integration",
    badge: "Code tools",
    setup: "api-key",
    shortDescription: "Token used by coding agents for repository operations and edits.",
  },
  { id: "google", name: "Google", description: "Gemini Pro and Flash models.", website: "https://aistudio.google.com/app/apikey", configured: false, kind: "model", badge: "Gemini", setup: "api-key", shortDescription: "Gemini Pro and Flash models.", recommendedModel: "gemini-2.5-pro", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"] },
  { id: "qwen", name: "Qwen", description: "Qwen models through Alibaba Cloud DashScope.", website: "https://dashscope.console.aliyun.com/apiKey", configured: false, kind: "model", badge: "Qwen", setup: "api-key", shortDescription: "Qwen models through Alibaba Cloud DashScope.", recommendedModel: "qwen-plus", models: ["qwen-plus", "qwen-max", "qwen2.5-coder-32b-instruct"] },
  { id: "xai", name: "xAI", description: "Grok models from xAI.", website: "https://console.x.ai/", configured: false, kind: "model", badge: "Grok", setup: "api-key", shortDescription: "Grok models from xAI.", models: ["grok-3", "grok-3-mini", "grok-2-vision"] },
  { id: "mistral", name: "Mistral", description: "Mistral, Pixtral, and Codestral models.", website: "https://console.mistral.ai/api-keys", configured: false, kind: "model", setup: "api-key", shortDescription: "Mistral, Pixtral, and Codestral models.", models: ["mistral-large-latest", "pixtral-large-latest", "codestral-latest"] },
  { id: "groq", name: "Groq", description: "Low-latency inference for open models.", website: "https://console.groq.com/keys", configured: false, kind: "model", badge: "Fast", setup: "api-key", shortDescription: "Low-latency inference for open models.", models: ["llama-3.3-70b-versatile", "deepseek-r1-distill-llama-70b", "mixtral-8x7b-32768"] },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek chat, reasoning, and coder models.", website: "https://platform.deepseek.com/api_keys", configured: false, kind: "model", badge: "Low cost", setup: "api-key", shortDescription: "DeepSeek chat, reasoning, and coder models.", models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"] },
  { id: "cohere", name: "Cohere", description: "Command models for RAG and enterprise agents.", website: "https://dashboard.cohere.com/api-keys", configured: false, kind: "model", setup: "api-key", shortDescription: "Command models for RAG and enterprise agents.", models: ["command-r-plus", "command-r", "command-a"] },
  { id: "cloudflare", name: "Cloudflare", description: "Workers AI models at the edge.", website: "https://dash.cloudflare.com/profile/api-tokens", configured: false, kind: "model", setup: "api-key", shortDescription: "Workers AI models at the edge.", models: ["@cf/meta/llama-3.1-8b-instruct", "@cf/qwen/qwen1.5-14b-chat-awq"] },
  { id: "fireworks", name: "Fireworks", description: "Fast hosted open-source model inference.", website: "https://fireworks.ai/account/api-keys", configured: false, kind: "model", setup: "api-key", shortDescription: "Fast hosted open-source model inference." },
  { id: "perplexity", name: "Perplexity", description: "Sonar models with web search grounding.", website: "https://www.perplexity.ai/settings/api", configured: false, kind: "model", badge: "Search", setup: "api-key", shortDescription: "Sonar models with web search grounding.", models: ["sonar", "sonar-pro", "sonar-reasoning-pro"] },
  { id: "together", name: "Together", description: "Hosted open-source models.", website: "https://api.together.ai/settings/api-keys", configured: false, kind: "model", setup: "api-key", shortDescription: "Hosted open-source models." },
  { id: "nebius", name: "Nebius", description: "High-performance hosted models.", website: "https://studio.nebius.ai/", configured: false, kind: "model", setup: "api-key", shortDescription: "High-performance hosted models." },
  { id: "akash", name: "Akash", description: "Decentralized AI cloud endpoint.", website: "https://akash.network/", configured: false, kind: "model", setup: "api-key", shortDescription: "Decentralized AI cloud endpoint." },
  { id: "replicate", name: "Replicate", description: "Hosted open-source and media models.", website: "https://replicate.com/account/api-tokens", configured: false, kind: "model", setup: "api-key", shortDescription: "Hosted open-source and media models." },
  { id: "tavily", name: "Tavily", description: "Web search integration for RAG and research.", website: "https://app.tavily.com/home", configured: false, kind: "integration", setup: "api-key", shortDescription: "Web search integration for RAG and research." },
  { id: "vercel", name: "Vercel", description: "Deployment and Vercel platform API token.", website: "https://vercel.com/account/settings/tokens", configured: false, kind: "integration", setup: "api-key", shortDescription: "Deployment and Vercel platform API token." },
  { id: "netlify", name: "Netlify", description: "Deployment and Netlify platform API token.", website: "https://app.netlify.com/user/applications#personal-access-tokens", configured: false, kind: "integration", setup: "api-key", shortDescription: "Deployment and Netlify platform API token." },
  { id: "maton", name: "Maton", description: "External gateway integration.", website: "https://maton.ai/", configured: false, kind: "integration", setup: "api-key", shortDescription: "External gateway integration." },
];

export function isModelProvider(provider: ProviderMeta) {
  return provider.kind !== "integration";
}
