/**
 * Notion service. Stores an Internal Integration Secret (`secret_…`) under
 * provider="notion" type="oauth".
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

async function notionFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const tk = await resolveProviderKey("notion", userId);
  if (!tk) throw notConnectedError("notion", "Notion");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tk}`);
  headers.set("Notion-Version", NOTION_VERSION);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${NOTION_API}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as { message?: string; [k: string]: unknown };
  if (!res.ok) throw new Error(`Notion ${res.status}: ${json.message ?? res.statusText}`);
  return json as T;
}

export async function validateAndStoreNotionToken(userId: string, token: string) {
  const res = await fetch(`${NOTION_API}/users/me`, {
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION },
  });
  const json = (await res.json()) as { object?: string; bot?: { owner?: { type?: string } }; name?: string; message?: string };
  if (!res.ok) throw new Error(`Notion token validation failed: ${json.message ?? "unknown"}`);
  await upsertAuthProfile({
    userId, provider: "notion", type: "oauth", token,
    metadata: { botName: json.name, ownerType: json.bot?.owner?.type },
  });
  return { bot: json };
}

export async function getNotionStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("notion", userId);
    if (!tk) return { connected: false };
    const me = await notionFetch<{ name?: string; type?: string }>(userId, "/users/me");
    return { connected: true, name: me.name };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function searchNotion(userId: string, query: string, filter?: "page" | "database") {
  const body: Record<string, unknown> = { query, page_size: 25 };
  if (filter) body.filter = { property: "object", value: filter };
  return notionFetch<{ results: unknown[] }>(userId, "/search", { method: "POST", body: JSON.stringify(body) });
}

export async function queryNotionDatabase(userId: string, databaseId: string, params: { filter?: unknown; sorts?: unknown[]; pageSize?: number } = {}) {
  return notionFetch<{ results: unknown[] }>(
    userId,
    `/databases/${databaseId}/query`,
    { method: "POST", body: JSON.stringify({ filter: params.filter, sorts: params.sorts, page_size: params.pageSize ?? 25 }) },
  );
}

export async function createNotionPage(userId: string, params: { parent: { database_id?: string; page_id?: string }; properties?: Record<string, unknown>; children?: unknown[]; title?: string }) {
  const properties = params.properties ?? (params.title
    ? { title: { title: [{ type: "text", text: { content: params.title } }] } }
    : {});
  return notionFetch<{ id: string; url: string }>(
    userId, "/pages",
    { method: "POST", body: JSON.stringify({ parent: params.parent, properties, children: params.children }) },
  );
}

export async function updateNotionPage(userId: string, pageId: string, properties: Record<string, unknown>) {
  return notionFetch<{ id: string }>(userId, `/pages/${pageId}`, { method: "PATCH", body: JSON.stringify({ properties }) });
}

export async function appendNotionBlocks(userId: string, blockId: string, children: unknown[]) {
  return notionFetch<{ results: unknown[] }>(
    userId, `/blocks/${blockId}/children`,
    { method: "PATCH", body: JSON.stringify({ children }) },
  );
}
