import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import { requireConfirmation } from "@/lib/ai/tools/confirm";
import {
  createStripeCheckoutSession,
  createStripePaymentLink,
  createStripeProductWithPrice,
  getStripeBalance,
  getStripeStatus,
  listStripeCustomers,
  listStripePrices,
  listStripeProducts,
  listStripeRecentPayments,
  refundStripePayment,
  validateAndStoreStripeKey,
} from "@/lib/services/stripe";

export function createStripeTools(userId: string) {
  return {
    stripe_get_status: tool({
      description: "Check whether the operator has connected Stripe and which mode (test/live) the key is in.",
      inputSchema: z.object({}),
      execute: async () => getStripeStatus(userId),
    }),
    stripe_save_key: tool({
      description: "Securely store a Stripe secret API key (sk_test_… or sk_live_…). Validates by calling /v1/account, then encrypts and saves.",
      inputSchema: z.object({ secretKey: z.string().min(20) }),
      execute: async ({ secretKey }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Stripe key save attempt", metadata: { tool: "stripe_save_key", mode: secretKey.startsWith("sk_live_") ? "live" : "test" } });
        const result = await validateAndStoreStripeKey(userId, secretKey);
        return { saved: true, accountId: result.account.id, email: result.account.email };
      },
    }),
    stripe_list_products: tool({
      description: "List active Stripe products.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      execute: async ({ limit }) => listStripeProducts(userId, limit ?? 20),
    }),
    stripe_list_prices: tool({
      description: "List Stripe prices, optionally filtered by product id.",
      inputSchema: z.object({
        productId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ productId, limit }) => listStripePrices(userId, productId, limit ?? 20),
    }),
    stripe_create_product: tool({
      description: "Create a Stripe product + price in one call. unitAmount is in the smallest currency unit (cents). recurring: 'month' or 'year' for subscriptions, omit for one-time.",
      inputSchema: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        unitAmount: z.number().int().min(1),
        currency: z.string().min(3).max(3).describe("ISO currency code, e.g. 'usd'."),
        recurring: z.enum(["month", "year"]).optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Stripe product created", metadata: { tool: "stripe_create_product", name: input.name } });
        return createStripeProductWithPrice(userId, input);
      },
    }),
    stripe_create_checkout: tool({
      description: "Create a hosted Stripe Checkout session. Returns a URL the operator can share or redirect a buyer to.",
      inputSchema: z.object({
        priceId: z.string().min(1),
        quantity: z.number().int().min(1).optional(),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
        mode: z.enum(["payment", "subscription"]).optional(),
        customerEmail: z.string().email().optional(),
      }),
      execute: async (input) => createStripeCheckoutSession(userId, input),
    }),
    stripe_create_payment_link: tool({
      description: "Create a permanent Stripe Payment Link for a price. Faster than a Checkout session when you just need a shareable URL.",
      inputSchema: z.object({
        priceId: z.string().min(1),
        quantity: z.number().int().min(1).optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Stripe payment link created", metadata: { tool: "stripe_create_payment_link", priceId: input.priceId } });
        return createStripePaymentLink(userId, input);
      },
    }),
    stripe_list_customers: tool({
      description: "List Stripe customers, optionally filtered by email.",
      inputSchema: z.object({
        email: z.string().email().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ email, limit }) => listStripeCustomers(userId, limit ?? 20, email),
    }),
    stripe_list_payments: tool({
      description: "List recent Stripe PaymentIntents (most recent first).",
      inputSchema: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      execute: async ({ limit }) => listStripeRecentPayments(userId, limit ?? 20),
    }),
    stripe_get_balance: tool({
      description: "Fetch the operator's current Stripe balance (available + pending).",
      inputSchema: z.object({}),
      execute: async () => getStripeBalance(userId),
    }),
    stripe_refund: tool({
      description: "Refund a Stripe payment by PaymentIntent id. amount in smallest currency unit; omit for full refund. Two-phase confirmation: first call returns requires_confirmation + token + summary; show the summary to the operator and only call back with the same args + __confirmToken on explicit approval.",
      inputSchema: z.object({
        paymentIntentId: z.string().min(1),
        amount: z.number().int().min(1).optional(),
        __confirmToken: z.string().optional().describe("Pass the token from a prior requires_confirmation response to actually execute."),
      }),
      execute: async ({ paymentIntentId, amount, __confirmToken }) => {
        const pending = await requireConfirmation({
          userId,
          tool: "stripe_refund",
          args: { paymentIntentId, amount },
          summary: amount
            ? `Refund ${(amount / 100).toFixed(2)} (smallest unit ${amount}) on ${paymentIntentId}?`
            : `FULL refund on ${paymentIntentId}?`,
          confirmToken: __confirmToken,
        });
        if (pending) return pending;
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Stripe refund issued", metadata: { tool: "stripe_refund", paymentIntentId, amount } });
        return refundStripePayment(userId, paymentIntentId, amount);
      },
    }),
  };
}
