import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  getSlackStatus,
  listSlackChannels,
  postSlackMessage,
  readSlackHistory,
  searchSlackMessages,
  validateAndStoreSlackToken,
} from "@/lib/services/slack";

export function createSlackTools(userId: string) {
  return {
    slack_get_status: tool({
      description: "Check whether Slack is connected.",
      inputSchema: z.object({}),
      execute: async () => getSlackStatus(userId),
    }),
    slack_save_token: tool({
      description: "Securely store a Slack Bot User OAuth Token (xoxb-…). Validates via auth.test.",
      inputSchema: z.object({ botToken: z.string().min(20) }),
      execute: async ({ botToken }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Slack token save attempt", metadata: { tool: "slack_save_token" } });
        return validateAndStoreSlackToken(userId, botToken);
      },
    }),
    slack_list_channels: tool({
      description: "List Slack channels (public + private the bot has been added to).",
      inputSchema: z.object({ types: z.string().optional() }),
      execute: async ({ types }) => listSlackChannels(userId, types),
    }),
    slack_post_message: tool({
      description: "Post a message to a Slack channel. `channel` may be a name (#general) or ID (Cxxxx). Use threadTs to reply in a thread.",
      inputSchema: z.object({
        channel: z.string().min(1),
        text: z.string().min(1),
        threadTs: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Slack message posted", metadata: { tool: "slack_post_message", channel: input.channel } });
        return postSlackMessage(userId, input);
      },
    }),
    slack_read_history: tool({
      description: "Read recent messages from a Slack channel.",
      inputSchema: z.object({ channel: z.string().min(1), limit: z.number().int().min(1).max(200).optional() }),
      execute: async (input) => readSlackHistory(userId, input),
    }),
    slack_search_messages: tool({
      description: "Search across Slack workspace messages (requires the search:read scope).",
      inputSchema: z.object({ query: z.string().min(1), count: z.number().int().min(1).max(100).optional() }),
      execute: async ({ query, count }) => searchSlackMessages(userId, query, count ?? 20),
    }),
  };
}
