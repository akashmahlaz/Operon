import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  getTwilioStatus,
  listTwilioMessages,
  sendTwilioSms,
  validateAndStoreTwilioCreds,
} from "@/lib/services/twilio";

export function createTwilioTools(userId: string) {
  return {
    twilio_get_status: tool({
      description: "Check whether Twilio is connected.",
      inputSchema: z.object({}),
      execute: async () => getTwilioStatus(userId),
    }),
    twilio_save_credentials: tool({
      description: "Securely store Twilio AccountSid (AC…) + AuthToken. Validates by fetching the account.",
      inputSchema: z.object({
        accountSid: z.string().regex(/^AC[a-zA-Z0-9]+$/),
        authToken: z.string().min(20),
      }),
      execute: async ({ accountSid, authToken }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Twilio creds save attempt", metadata: { tool: "twilio_save_credentials", accountSid } });
        return validateAndStoreTwilioCreds(userId, accountSid, authToken);
      },
    }),
    twilio_send_sms: tool({
      description: "Send an SMS via Twilio. `from` must be a Twilio number you own. `to` must be E.164 (+15551234567).",
      inputSchema: z.object({
        from: z.string().min(5),
        to: z.string().min(5),
        body: z.string().min(1).max(1600),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Twilio SMS sent", metadata: { tool: "twilio_send_sms", to: input.to } });
        return sendTwilioSms(userId, input);
      },
    }),
    twilio_list_messages: tool({
      description: "List recent Twilio Messages (sent + received).",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      execute: async ({ limit }) => listTwilioMessages(userId, limit ?? 20),
    }),
  };
}
