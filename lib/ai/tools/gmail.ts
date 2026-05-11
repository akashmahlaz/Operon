import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  createGmailDraft,
  getGmailStatus,
  listGmailLabels,
  modifyGmailLabels,
  readGmailMessage,
  replyToGmail,
  searchGmail,
  sendGmail,
  trashGmailMessage,
  validateAndStoreGoogleToken,
} from "@/lib/services/gmail";

export function createGmailTools(userId: string) {
  return {
    gmail_get_status: tool({
      description: "Check whether the operator has connected Google/Gmail and return the email address.",
      inputSchema: z.object({}),
      execute: async () => getGmailStatus(userId),
    }),
    gmail_save_token: tool({
      description: "Securely store a Google OAuth access token with Gmail scope. Validates by fetching the user profile, then encrypts and saves.",
      inputSchema: z.object({ token: z.string().min(20) }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Google token save attempt", metadata: { tool: "gmail_save_token" } });
        const result = await validateAndStoreGoogleToken(userId, token);
        return { saved: true, email: result.profile.emailAddress };
      },
    }),
    gmail_list_labels: tool({
      description: "List Gmail labels (system + user). Use the returned label ids in modify/search.",
      inputSchema: z.object({}),
      execute: async () => ({ labels: await listGmailLabels(userId) }),
    }),
    gmail_search: tool({
      description: "Search Gmail with a Gmail query string (e.g. 'from:stripe is:unread newer_than:7d'). Returns matching messages with headers + snippet.",
      inputSchema: z.object({
        query: z.string().min(1),
        maxResults: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ query, maxResults }) => ({ messages: await searchGmail(userId, query, maxResults ?? 10) }),
    }),
    gmail_read: tool({
      description: "Read the full body and headers of one Gmail message by id.",
      inputSchema: z.object({ messageId: z.string().min(1) }),
      execute: async ({ messageId }) => readGmailMessage(userId, messageId),
    }),
    gmail_send: tool({
      description: "Send a Gmail message immediately. Confirm with the operator before sending unless the request was explicit.",
      inputSchema: z.object({
        to: z.string().min(3),
        subject: z.string().min(1),
        body: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Gmail message sent", metadata: { tool: "gmail_send", to: input.to, subject: input.subject } });
        return sendGmail(userId, input);
      },
    }),
    gmail_create_draft: tool({
      description: "Create a Gmail draft (does NOT send). Safer than gmail_send when the operator wants to review before sending.",
      inputSchema: z.object({
        to: z.string().min(3),
        subject: z.string().min(1),
        body: z.string().min(1),
        cc: z.string().optional(),
        bcc: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Gmail draft created", metadata: { tool: "gmail_create_draft", to: input.to } });
        return createGmailDraft(userId, input);
      },
    }),
    gmail_reply: tool({
      description: "Reply to an existing Gmail message in the same thread. Auto-prefixes 'Re:' to the subject.",
      inputSchema: z.object({
        messageId: z.string().min(1),
        body: z.string().min(1),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Gmail reply sent", metadata: { tool: "gmail_reply", messageId: input.messageId } });
        return replyToGmail(userId, input);
      },
    }),
    gmail_modify_labels: tool({
      description: "Add or remove Gmail labels on a message. Common ops: archive (remove INBOX), mark-read (remove UNREAD), star (add STARRED).",
      inputSchema: z.object({
        messageId: z.string().min(1),
        addLabelIds: z.array(z.string()).optional(),
        removeLabelIds: z.array(z.string()).optional(),
      }),
      execute: async ({ messageId, addLabelIds, removeLabelIds }) =>
        modifyGmailLabels(userId, messageId, addLabelIds ?? [], removeLabelIds ?? []),
    }),
    gmail_trash: tool({
      description: "Move a Gmail message to Trash. Reversible until Gmail purges (~30 days).",
      inputSchema: z.object({ messageId: z.string().min(1) }),
      execute: async ({ messageId }) => {
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Gmail message trashed", metadata: { tool: "gmail_trash", messageId } });
        return trashGmailMessage(userId, messageId);
      },
    }),
  };
}
