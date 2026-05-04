import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isModelProvider, providerCatalog } from "@/components/dashboard/settings/provider-catalog";
import { listAuthProfiles, removeAuthProfile, updateAuthProfileModels, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { defaultModelFor, discoverModelsWithSource } from "@/lib/services/model-discovery";
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

  // For each configured provider that has no stored profile models, eagerly discover
  // models so the response always contains real API-fetched model IDs rather than
  // static catalog placeholders. Results are in-memory cached (5 min TTL).
  const providers = await Promise.all(
    providerCatalog.map(async (provider) => {
      const profile = profileByProvider.get(provider.id);
      const isConfigured = Boolean(profile) || provider.configured;

      let models: string[] | undefined = profile?.models?.length ? profile.models : undefined;
      let modelsSource: "api" | "profile" | "static" | "unavailable" = models ? "profile" : "static";

      // No stored models but provider is configured — try live discovery (uses cache).
      // This is the MiniMax env-key path and any future env-backed provider path.
      if (!models && isConfigured) {
        try {
          const discovered = await discoverModelsWithSource({ providerId: provider.id, userId });
          if (discovered.source === "api") {
            models = discovered.models.map((m) => m.id);
          }
          modelsSource = discovered.source;
        } catch {
          modelsSource = "unavailable";
        }
      }

      return {
        ...provider,
        configured: isConfigured,
        tokenRef: profile?.tokenRef || provider.tokenRef,
        baseUrl: profile?.baseUrl,
        models: models ?? provider.models ?? [],
        modelsFromProfile: modelsSource === "api" || modelsSource === "profile",
        modelsSource,
        updatedAt: profile?.updatedAt || provider.updatedAt,
        defaultModel: profile?.defaultModel,
        metadata: profile?.metadata,
      };
    }),
  );

  return NextResponse.json({
    providers,
    profiles,
    defaultModel: settings?.defaultModel || (recentModelProfile ? `${recentModelProfile.provider}/${recentModelProfile.defaultModel || recentModelProfile.models?.[0]}` : "minimax/MiniMax-M2.1"),
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
    const discovered = await discoverModelsWithSource({ providerId, userId, force: true, baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl : undefined });
    const modelIds = discovered.models.map((model) => model.id);
    const defaultModel = modelIds.length > 0 ? defaultModelFor(providerId, modelIds) : undefined;
    const profile = discovered.source === "api"
      ? await updateAuthProfileModels(userId, providerId, modelIds, defaultModel)
      : null;
    return NextResponse.json({ models: discovered.models, source: discovered.source, defaultModel, profile });
  }

  const providerId = String(body?.provider || "");
  const apiKey = String(body?.apiKey || "").trim();
  const baseUrl = typeof body?.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : undefined;
  const provider = providerCatalog.find((item) => item.id === providerId);

  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 400 });
  if (!apiKey) return NextResponse.json({ error: "apiKey required" }, { status: 400 });

  let models: Array<{ id: string; name: string; provider: string }> = [];
  let source: "api" | "static" | "unavailable" = "unavailable";
  if (isModelProvider(provider)) {
    const discovered = await discoverModelsWithSource({ providerId, apiKey, baseUrl, force: true });
    models = discovered.models;
    source = discovered.source;
  }

  const modelIds = models.map((model) => model.id);
  const defaultModel = modelIds.length > 0 ? defaultModelFor(providerId, modelIds) : undefined;
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
  return NextResponse.json({ ok: true, profile, models, source, defaultModel });
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
