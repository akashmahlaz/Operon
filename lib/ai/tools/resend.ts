import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  createResendDomain,
  getResendStatus,
  listResendDomains,
  sendResendEmail,
  validateAndStoreResendKey,
} from "@/lib/services/resend";

export function createResendTools(userId: string) {
  return {
    resend_get_status: tool({
      description: "Check whether Resend is connected.",
      inputSchema: z.object({}),
      execute: async () => getResendStatus(userId),
    }),
    resend_save_key: tool({
      description: "Securely store a Resend API key (re_…).",
      inputSchema: z.object({ apiKey: z.string().min(20) }),
      execute: async ({ apiKey }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Resend key save attempt", metadata: { tool: "resend_save_key" } });
        return validateAndStoreResendKey(userId, apiKey);
      },
    }),
    resend_send_email: tool({
      description: "Send a transactional email via Resend. `from` must be a verified domain address.",
      inputSchema: z.object({
        from: z.string().min(3),
        to: z.union([z.string().email(), z.array(z.string().email())]),
        subject: z.string().min(1),
        html: z.string().optional(),
        text: z.string().optional(),
        replyTo: z.string().email().optional(),
        cc: z.array(z.string().email()).optional(),
        bcc: z.array(z.string().email()).optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Resend email sent", metadata: { tool: "resend_send_email", to: input.to } });
        return sendResendEmail(userId, input);
      },
    }),
    resend_list_domains: tool({
      description: "List domains configured in Resend.",
      inputSchema: z.object({}),
      execute: async () => listResendDomains(userId),
    }),
    resend_create_domain: tool({
      description: "Add a domain to Resend (requires DNS setup).",
      inputSchema: z.object({ name: z.string().min(3), region: z.string().optional() }),
      execute: async ({ name, region }) => createResendDomain(userId, name, region),
    }),
  };
}
