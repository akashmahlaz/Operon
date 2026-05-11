/**
 * Discord Bot API service. Stores a Bot Token under provider="discord"
 * type="token". Use the `Authorization: Bot <token>` header.
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const DISCORD_API = "https://discord.com/api/v10";

async function discordFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const tk = await resolveProviderKey("discord", userId);
  if (!tk) throw notConnectedError("discord", "Discord");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bot ${tk}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${DISCORD_API}${path}`, { ...init, headers });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as { message?: string; [k: string]: unknown }) : {};
  if (!res.ok) throw new Error(`Discord ${res.status}: ${json.message ?? res.statusText}`);
  return json as T;
}

export async function validateAndStoreDiscordToken(userId: string, botToken: string) {
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bot ${botToken}` } });
  const json = (await res.json()) as { id?: string; username?: string; message?: string };
  if (!res.ok) throw new Error(`Discord token validation failed: ${json.message ?? res.statusText}`);
  await upsertAuthProfile({
    userId, provider: "discord", type: "token", token: botToken,
    metadata: { botId: json.id, botName: json.username },
  });
  return { bot: { id: json.id, username: json.username } };
}

export async function getDiscordStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("discord", userId);
    if (!tk) return { connected: false };
    const me = await discordFetch<{ id: string; username: string }>(userId, "/users/@me");
    return { connected: true, bot: me };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listDiscordGuilds(userId: string) {
  return discordFetch<Array<{ id: string; name: string; permissions: string }>>(userId, "/users/@me/guilds");
}

export async function listDiscordChannels(userId: string, guildId: string) {
  return discordFetch<Array<{ id: string; name: string; type: number }>>(userId, `/guilds/${guildId}/channels`);
}

export async function sendDiscordMessage(userId: string, channelId: string, content: string) {
  return discordFetch<{ id: string; channel_id: string }>(
    userId, `/channels/${channelId}/messages`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
}

export async function readDiscordHistory(userId: string, channelId: string, limit: number = 25) {
  return discordFetch<unknown[]>(userId, `/channels/${channelId}/messages?limit=${limit}`);
}
