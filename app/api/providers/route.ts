import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isModelProvider, providerCatalog } from "@/components/dashboard/settings/provider-catalog";
import { listAuthProfiles, removeAuthProfile, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { defaultModelFor, discoverModels } from "@/lib/services/model-discovery";
import { getMostRecentModelProfile } from "@/lib/services/auth-profiles";
import { appendLog } from "@/lib/services/logs";
import { getUserSettings, setDefaultModel } from "@/lib/services/user-settings";

async function userIdOf(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "anon";
  return (session.user as { id?: string }).id || session.user.email || "anon";
}

export async function GET() {
  const userId = await userIdOf();
  const [profiles, settings, recentModelProfile] = await Promise.all([
    listAuthProfiles(userId),
    getUserSettings(userId),
    getMostRecentModelProfile(userId),
  ]);
  const profileByProvider = new Map(profiles.map((profile) => [profile.provider, profile]));
  const providers = providerCatalog.map((provider) => {
    const profile = profileByProvider.get(provider.id);
    return {
      ...provider,
      configured: Boolean(profile) || provider.configured,
      tokenRef: profile?.tokenRef || provider.tokenRef,
      baseUrl: profile?.baseUrl,
      models: profile?.models?.length ? profile.models : provider.models,
      updatedAt: profile?.updatedAt || provider.updatedAt,
      defaultModel: profile?.defaultModel,
      metadata: profile?.metadata,
    };
  });
  return NextResponse.json({
    providers,
    profiles,
    defaultModel: settings?.defaultModel || (recentModelProfile ? `${recentModelProfile.provider}/${recentModelProfile.defaultModel || recentModelProfile.models?.[0]}` : "minimax/MiniMax-M2.7"),
    recentProviderId: recentModelProfile?.provider || "minimax",
  });
}

export async function POST(req: Request) {
  const userId = await userIdOf();
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "connect";

  if (action === "set-default") {
    if (typeof body?.model !== "string" || !body.model.includes("/")) {
      return NextResponse.json({ error: "model must use provider/model format" }, { status: 400 });
    }
    const saved = await setDefaultModel(userId, body.model);
    await appendLog({ userId, level: "info", source: "providers", message: "Default model updated", metadata: { model: body.model } });
    return NextResponse.json({ ok: true, defaultModel: saved?.defaultModel });
  }

  if (action === "refresh-models") {
    const providerId = String(body?.provider || "");
    if (!providerId) return NextResponse.json({ error: "provider required" }, { status: 400 });
    const models = await discoverModels({ providerId, userId, force: true, baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl : undefined });
    return NextResponse.json({ models });
  }

  const providerId = String(body?.provider || "");
  const apiKey = String(body?.apiKey || "").trim();
  const baseUrl = typeof body?.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : undefined;
  const provider = providerCatalog.find((item) => item.id === providerId);

  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

  let models = provider.models?.map((id) => ({ id, name: id, provider: providerId })) || [];
  if (isModelProvider(provider)) {
    models = await discoverModels({ providerId, apiKey, baseUrl, force: true });
  }

  const modelIds = models.map((model) => model.id);
  const defaultModel = defaultModelFor(providerId, modelIds);
  const profile = await upsertAuthProfile({
    userId,
    provider: providerId,
    type: provider.setup === "oauth" ? "oauth" : "api_key",
    token: apiKey,
    baseUrl,
    models: modelIds,
    defaultModel,
  });

  await appendLog({ userId, level: "info", source: "providers", message: "Provider connected", metadata: { provider: providerId, models: modelIds.length } });
  return NextResponse.json({ ok: true, profile, models, defaultModel });
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  const url = new URL(req.url);
  const profileId = url.searchParams.get("profileId");
  const provider = url.searchParams.get("provider");
  if (!profileId && !provider) return NextResponse.json({ error: "profileId or provider required" }, { status: 400 });
  await removeAuthProfile(userId, profileId || `${provider}:api_key`);
  await appendLog({ userId, level: "info", source: "providers", message: "Provider disconnected", metadata: { profileId, provider } });
  return NextResponse.json({ ok: true });
}
