import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const GRAPH_API = "https://graph.facebook.com/v21.0";

async function metaFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${GRAPH_API}${path}`;
  const sep = url.includes("?") ? "&" : "?";
  const response = await fetch(`${url}${sep}access_token=${encodeURIComponent(token)}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Meta Graph API ${response.status}: ${text || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function validateAndStoreMetaToken(userId: string, token: string) {
  const me = await metaFetch<{ id: string; name: string }>(token, "/me?fields=id,name");
  await upsertAuthProfile({
    userId,
    provider: "meta",
    type: "oauth",
    token,
    metadata: { metaUserId: me.id, name: me.name },
  });
  return { user: me };
}

export async function getMetaStatus(userId: string) {
  const token = await resolveProviderKey("meta", userId);
  if (!token) return { connected: false as const };
  const me = await metaFetch<{ id: string; name: string }>(token, "/me?fields=id,name");
  return { connected: true as const, user: me };
}

export interface MetaAdAccount {
  id: string;
  account_id: string;
  name: string;
  currency: string;
  account_status: number;
}

export async function listMetaAdAccounts(userId: string) {
  const token = await resolveProviderKey("meta", userId);
  if (!token) throw new Error("Meta token not configured");
  const data = await metaFetch<{ data: MetaAdAccount[] }>(
    token,
    "/me/adaccounts?fields=id,account_id,name,currency,account_status&limit=50",
  );
  return data.data ?? [];
}

export async function listMetaCampaigns(userId: string, adAccountId: string, limit = 25) {
  const token = await resolveProviderKey("meta", userId);
  if (!token) throw new Error("Meta token not configured");
  const data = await metaFetch<{ data: unknown[] }>(
    token,
    `/${encodeURIComponent(adAccountId)}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time&limit=${limit}`,
  );
  return data.data ?? [];
}

export async function getMetaCampaignInsights(userId: string, campaignId: string, datePreset = "last_7d") {
  const token = await resolveProviderKey("meta", userId);
  if (!token) throw new Error("Meta token not configured");
  const data = await metaFetch<{ data: unknown[] }>(
    token,
    `/${encodeURIComponent(campaignId)}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,actions&date_preset=${encodeURIComponent(datePreset)}`,
  );
  return data.data ?? [];
}

export async function pauseMetaCampaign(userId: string, campaignId: string) {
  const token = await resolveProviderKey("meta", userId);
  if (!token) throw new Error("Meta token not configured");
  return metaFetch<{ success?: boolean }>(token, `/${encodeURIComponent(campaignId)}`, {
    method: "POST",
    body: JSON.stringify({ status: "PAUSED" }),
  });
}

export async function resumeMetaCampaign(userId: string, campaignId: string) {
  const token = await resolveProviderKey("meta", userId);
  if (!token) throw new Error("Meta token not configured");
  return metaFetch<{ success?: boolean }>(token, `/${encodeURIComponent(campaignId)}`, {
    method: "POST",
    body: JSON.stringify({ status: "ACTIVE" }),
  });
}
