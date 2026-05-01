import crypto from "crypto";
import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";

export type AuthProfileType = "api_key" | "oauth" | "token";

export interface StoredAuthProfile extends Document {
  _id: string;
  userId: string;
  profileId: string;
  type: AuthProfileType;
  provider: string;
  tokenEncrypted: string;
  tokenRef: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAuthProfile {
  profileId: string;
  type: AuthProfileType;
  provider: string;
  tokenRef: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const ENV_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  github: "GITHUB_TOKEN",
  "github-copilot": "GITHUB_TOKEN",
  openrouter: "OPENROUTER_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  cohere: "COHERE_API_KEY",
  cloudflare: "CLOUDFLARE_API_KEY",
  fireworks: "FIREWORKS_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
  together: "TOGETHER_API_KEY",
  nebius: "NEBIUS_API_KEY",
  akash: "AKASH_API_KEY",
  replicate: "REPLICATE_API_KEY",
  minimax: "MINIMAX_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
  dashscope: "DASHSCOPE_API_KEY",
  tavily: "TAVILY_API_KEY",
  vercel: "VERCEL_TOKEN",
  netlify: "NETLIFY_TOKEN",
  maton: "MATON_API_KEY",
};

const authProfiles = () => collections.authProfiles<StoredAuthProfile>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    authProfiles().createIndex({ userId: 1, profileId: 1 }, { unique: true }),
    authProfiles().createIndex({ userId: 1, provider: 1 }),
    authProfiles().createIndex({ userId: 1, updatedAt: -1 }),
  ]).then(() => undefined);
  return indexesReady;
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "operon-development-secret";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptToken(value: string) {
  if (!value.startsWith("v1:")) return value;
  const [, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function tokenRef(token: string) {
  if (token.length <= 10) return `${token.slice(0, 2)}...${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function toPublic(profile: StoredAuthProfile): PublicAuthProfile {
  return {
    profileId: profile.profileId,
    type: profile.type,
    provider: profile.provider,
    tokenRef: profile.tokenRef,
    baseUrl: profile.baseUrl,
    models: profile.models,
    defaultModel: profile.defaultModel,
    metadata: profile.metadata,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export async function listAuthProfiles(userId: string) {
  await ensureIndexes();
  const rows = await authProfiles().find({ userId }).sort({ updatedAt: -1 }).toArray();
  return rows.map(toPublic);
}

export async function getAuthProfile(userId: string, provider: string, type?: AuthProfileType) {
  await ensureIndexes();
  const profile = await authProfiles().findOne(type ? { userId, provider, type } : { userId, provider });
  return profile ? toPublic(profile) : null;
}

export async function upsertAuthProfile({
  userId,
  provider,
  type = "api_key",
  token,
  baseUrl,
  models,
  defaultModel,
  metadata,
}: {
  userId: string;
  provider: string;
  type?: AuthProfileType;
  token: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureIndexes();
  const now = new Date().toISOString();
  const profileId = `${provider}:${type}`;
  await authProfiles().updateOne(
    { userId, profileId },
    {
      $set: {
        type,
        provider,
        tokenEncrypted: encryptToken(token),
        tokenRef: tokenRef(token),
        baseUrl: baseUrl || undefined,
        models,
        defaultModel,
        metadata,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        userId,
        profileId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  const saved = await authProfiles().findOne({ userId, profileId });
  return saved ? toPublic(saved) : null;
}

export async function removeAuthProfile(userId: string, profileId: string) {
  await ensureIndexes();
  await authProfiles().deleteOne({ userId, profileId });
}

export async function resolveProviderKey(provider: string, userId?: string) {
  await ensureIndexes();
  if (userId) {
    const profile = await authProfiles().findOne({ userId, provider });
    if (profile?.tokenEncrypted) return decryptToken(profile.tokenEncrypted);
  }
  const envKey = ENV_MAP[provider];
  return envKey ? process.env[envKey] : undefined;
}

export async function resolveProviderBaseUrl(provider: string, userId?: string) {
  await ensureIndexes();
  if (!userId) return undefined;
  const profile = await authProfiles().findOne({ userId, provider });
  return profile?.baseUrl;
}

export async function getMostRecentModelProfile(userId: string) {
  await ensureIndexes();
  const profile = await authProfiles().findOne(
    { userId, models: { $exists: true, $ne: [] } },
    { sort: { updatedAt: -1 } },
  );
  return profile ? toPublic(profile) : null;
}
