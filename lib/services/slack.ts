/**
 * Slack Web API service. Stores a Bot User OAuth Token (xoxb-…) under
 * provider="slack" type="oauth".
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const SLACK_API = "https://slack.com/api";

interface SlackResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

async function slackFetch<T extends SlackResponse>(
  userId: string,
  method: string,
  init: { params?: Record<string, string | number | boolean | undefined>; body?: Record<string, unknown> } = {},
): Promise<T> {
  const tk = await resolveProviderKey("slack", userId);
  if (!tk) throw notConnectedError("slack", "Slack");
  const headers: Record<string, string> = { Authorization: `Bearer ${tk}` };
  let url = `${SLACK_API}/${method}`;
  let body: BodyInit | undefined;
  if (init.body) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    body = JSON.stringify(init.body);
  } else if (init.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(init.params)) if (v != null) qs.set(k, String(v));
    url += `?${qs.toString()}`;
  }
  const res = await fetch(url, { method: init.body ? "POST" : "GET", headers, body });
  const json = (await res.json()) as T;
  if (!res.ok || !json.ok) {
    throw new Error(`Slack ${res.status} ${method}: ${json.error ?? res.statusText}`);
  }
  return json;
}

export async function validateAndStoreSlackToken(userId: string, botToken: string) {
  const res = await fetch(`${SLACK_API}/auth.test`, { headers: { Authorization: `Bearer ${botToken}` } });
  const json = (await res.json()) as { ok: boolean; error?: string; team?: string; user?: string; team_id?: string; user_id?: string };
  if (!json.ok) throw new Error(`Slack token validation failed: ${json.error ?? "unknown"}`);
  await upsertAuthProfile({
    userId, provider: "slack", type: "oauth", token: botToken,
    metadata: { team: json.team, teamId: json.team_id, botUser: json.user, botUserId: json.user_id },
  });
  return { team: json.team, botUser: json.user };
}

export async function getSlackStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("slack", userId);
    if (!tk) return { connected: false };
    const auth = await slackFetch<SlackResponse & { team?: string; user?: string }>(userId, "auth.test");
    return { connected: true, team: auth.team, botUser: auth.user };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listSlackChannels(userId: string, types: string = "public_channel,private_channel") {
  return slackFetch<SlackResponse & { channels: Array<{ id: string; name: string; is_private: boolean }> }>(
    userId, "conversations.list", { params: { types, limit: 200, exclude_archived: true } },
  );
}

export async function postSlackMessage(userId: string, params: { channel: string; text: string; threadTs?: string; blocks?: unknown[] }) {
  return slackFetch<SlackResponse & { ts: string; channel: string }>(
    userId, "chat.postMessage",
    { body: { channel: params.channel, text: params.text, thread_ts: params.threadTs, blocks: params.blocks } },
  );
}

export async function readSlackHistory(userId: string, params: { channel: string; limit?: number }) {
  return slackFetch<SlackResponse & { messages: unknown[] }>(
    userId, "conversations.history", { params: { channel: params.channel, limit: params.limit ?? 30 } },
  );
}

export async function searchSlackMessages(userId: string, query: string, count: number = 20) {
  return slackFetch<SlackResponse & { messages: { matches: unknown[] } }>(
    userId, "search.messages", { params: { query, count } },
  );
}
