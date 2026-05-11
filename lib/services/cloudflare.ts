import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const CF_API = "https://api.cloudflare.com/client/v4";

interface CFResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: unknown[];
  result: T;
  result_info?: { count: number; total_count: number; page: number; per_page: number };
}

async function cfFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = (await response.json().catch(() => ({}))) as CFResponse<T>;
  if (!response.ok || !data.success) {
    const msg = data.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || response.statusText;
    throw new Error(`Cloudflare API ${response.status}: ${msg}`);
  }
  return data.result;
}

export async function validateAndStoreCloudflareToken(userId: string, token: string) {
  const verify = await cfFetch<{ id: string; status: string }>(token, "/user/tokens/verify");
  await upsertAuthProfile({
    userId,
    provider: "cloudflare",
    type: "api_key",
    token,
    metadata: { tokenId: verify.id, status: verify.status },
  });
  return { verify };
}

export async function getCloudflareStatus(userId: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) return { connected: false as const };
  const verify = await cfFetch<{ id: string; status: string }>(token, "/user/tokens/verify");
  return { connected: true as const, status: verify.status };
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  account: { id: string; name: string };
}

export async function listCloudflareZones(userId: string, perPage = 50) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<CloudflareZone[]>(token, `/zones?per_page=${perPage}`);
}

export interface CloudflareDnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
  proxied?: boolean;
}

export async function listCloudflareDnsRecords(userId: string, zoneId: string, type?: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  const q = type ? `?type=${encodeURIComponent(type)}&per_page=100` : "?per_page=100";
  return cfFetch<CloudflareDnsRecord[]>(token, `/zones/${encodeURIComponent(zoneId)}/dns_records${q}`);
}

export async function createCloudflareDnsRecord(
  userId: string,
  zoneId: string,
  input: { type: string; name: string; content: string; ttl?: number; proxied?: boolean; comment?: string },
) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<CloudflareDnsRecord>(token, `/zones/${encodeURIComponent(zoneId)}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ ttl: 1, ...input }),
  });
}

export async function updateCloudflareDnsRecord(
  userId: string,
  zoneId: string,
  recordId: string,
  input: Partial<{ type: string; name: string; content: string; ttl: number; proxied: boolean; comment: string }>,
) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<CloudflareDnsRecord>(
    token,
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export async function deleteCloudflareDnsRecord(userId: string, zoneId: string, recordId: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<{ id: string }>(
    token,
    `/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );
}

export async function purgeCloudflareCache(userId: string, zoneId: string, opts: { everything?: boolean; files?: string[]; tags?: string[] }) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  const body: Record<string, unknown> = {};
  if (opts.everything) body.purge_everything = true;
  if (opts.files?.length) body.files = opts.files;
  if (opts.tags?.length) body.tags = opts.tags;
  return cfFetch<{ id: string }>(token, `/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listCloudflareAccounts(userId: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<Array<{ id: string; name: string; type: string }>>(token, "/accounts?per_page=50");
}

export async function listCloudflareWorkers(userId: string, accountId: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<Array<{ id: string; created_on: string; modified_on: string }>>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts`,
  );
}

export async function listCloudflareR2Buckets(userId: string, accountId: string) {
  const token = await resolveProviderKey("cloudflare", userId);
  if (!token) throw new Error("Cloudflare token not configured");
  return cfFetch<{ buckets: Array<{ name: string; creation_date: string }> }>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/r2/buckets`,
  );
}
