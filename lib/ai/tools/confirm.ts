import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  consumePendingConfirmation,
  createPendingConfirmation,
} from "@/lib/services/pending-confirmations";

/**
 * Two-phase confirmation primitives.
 *
 * Usage in a destructive tool:
 *
 *   import { requireConfirmation } from "@/lib/ai/tools/confirm";
 *
 *   execute: async (input, _meta) => {
 *     const pending = await requireConfirmation({
 *       userId, tool: "stripe_refund", args: input,
 *       summary: `Refund $${input.amount/100} to ${input.paymentIntentId}?`,
 *       confirmToken: input.__confirmToken,
 *     });
 *     if (pending) return pending;
 *     // …actually perform the refund…
 *   }
 *
 * The model first sees `{ requires_confirmation: true, token, summary }`,
 * relays the summary to the operator, then on approval calls back with the
 * same arguments PLUS `__confirmToken: <token>` and the destructive code path
 * runs.
 */

export type ConfirmableArgs<T> = T & { __confirmToken?: string };

export async function requireConfirmation(input: {
  userId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  confirmToken?: string;
}) {
  if (input.confirmToken) {
    const pending = await consumePendingConfirmation(input.userId, input.confirmToken);
    if (!pending) {
      const fresh = await createPendingConfirmation(input);
      return {
        ...fresh,
        error: "confirmation token expired or invalid; ask the operator again and pass the new token",
      };
    }
    if (pending.tool !== input.tool) {
      return {
        requires_confirmation: true,
        error: `confirmation token was for tool '${pending.tool}', not '${input.tool}'`,
      };
    }
    await appendLog({
      userId: input.userId,
      level: "warn",
      source: "ai-tool",
      message: "Destructive tool confirmed",
      metadata: { tool: input.tool, token: input.confirmToken },
    });
    return null; // proceed
  }
  await appendLog({
    userId: input.userId,
    level: "info",
    source: "ai-tool",
    message: "Destructive tool requires confirmation",
    metadata: { tool: input.tool, summary: input.summary },
  });
  return createPendingConfirmation(input);
}

export function createConfirmTools(userId: string) {
  return {
    confirm_action: tool({
      description:
        "Confirm and execute a previously-requested destructive action (refund, deletion, cache purge, etc.). " +
        "Only call AFTER you have shown the operator the action's `summary` verbatim and they have explicitly approved it. " +
        "Pass the same `token` you received in the original `requires_confirmation` response.",
      inputSchema: z.object({
        token: z.string().min(8),
        approve: z.boolean().describe("Must be true. Pass false to cancel and discard the pending action."),
      }),
      execute: async ({ token, approve }) => {
        if (!approve) {
          await consumePendingConfirmation(userId, token); // discard
          return { cancelled: true };
        }
        // The actual execution is performed by re-calling the original tool
        // with `__confirmToken: token`. We just surface a hint here.
        return {
          ready: true,
          token,
          hint: "Call the original destructive tool again with the SAME arguments PLUS `__confirmToken: <token>`.",
        };
      },
    }),
  };
}
