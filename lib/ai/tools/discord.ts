import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  getDiscordStatus,
  listDiscordChannels,
  listDiscordGuilds,
  readDiscordHistory,
  sendDiscordMessage,
  validateAndStoreDiscordToken,
} from "@/lib/services/discord";

export function createDiscordTools(userId: string) {
  return {
    discord_get_status: tool({
      description: "Check whether Discord (bot) is connected.",
      inputSchema: z.object({}),
      execute: async () => getDiscordStatus(userId),
    }),
    discord_save_token: tool({
      description: "Securely store a Discord Bot Token. Validates via /users/@me.",
      inputSchema: z.object({ botToken: z.string().min(20) }),
      execute: async ({ botToken }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Discord token save attempt", metadata: { tool: "discord_save_token" } });
        return validateAndStoreDiscordToken(userId, botToken);
      },
    }),
    discord_list_guilds: tool({
      description: "List Discord guilds (servers) the bot has been added to.",
      inputSchema: z.object({}),
      execute: async () => listDiscordGuilds(userId),
    }),
    discord_list_channels: tool({
      description: "List channels in a specific Discord guild.",
      inputSchema: z.object({ guildId: z.string().min(1) }),
      execute: async ({ guildId }) => listDiscordChannels(userId, guildId),
    }),
    discord_send_message: tool({
      description: "Send a message to a Discord channel by id.",
      inputSchema: z.object({ channelId: z.string().min(1), content: z.string().min(1).max(2000) }),
      execute: async ({ channelId, content }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Discord message sent", metadata: { tool: "discord_send_message", channelId } });
        return sendDiscordMessage(userId, channelId, content);
      },
    }),
    discord_read_history: tool({
      description: "Read recent messages from a Discord channel.",
      inputSchema: z.object({ channelId: z.string().min(1), limit: z.number().int().min(1).max(100).optional() }),
      execute: async ({ channelId, limit }) => readDiscordHistory(userId, channelId, limit ?? 25),
    }),
  };
}
