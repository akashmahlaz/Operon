import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const STRIPE_API = "https://api.stripe.com/v1";

function formEncode(input: Record<string, unknown>, prefix?: string): string {
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    const key = prefix ? `${prefix}[${rawKey}]` : rawKey;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        if (typeof item === "object" && item !== null) {
          parts.push(formEncode(item as Record<string, unknown>, `${key}[${idx}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${idx}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(formEncode(value as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

async function stripeFetch<T>(token: string, path: string, init: RequestInit & { form?: Record<string, unknown> } = {}): Promise<T> {
  const { form, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (form) headers.set("Content-Type", "application/x-www-form-urlencoded");
  const response = await fetch(`${STRIPE_API}${path}`, {
    ...rest,
    headers,
    body: form ? formEncode(form) : rest.body,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const err = (data?.error as { message?: string; type?: string })?.message || response.statusText;
    throw new Error(`Stripe API ${response.status}: ${err}`);
  }
  return data as T;
}

export async function validateAndStoreStripeKey(userId: string, secretKey: string) {
  const account = await stripeFetch<{ id: string; email: string; business_profile?: { name?: string } }>(secretKey, "/account");
  await upsertAuthProfile({
    userId,
    provider: "stripe",
    type: "api_key",
    token: secretKey,
    metadata: {
      accountId: account.id,
      email: account.email,
      businessName: account.business_profile?.name,
      mode: secretKey.startsWith("sk_live_") ? "live" : "test",
    },
  });
  return { account };
}

export async function getStripeStatus(userId: string) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) return { connected: false as const };
  const account = await stripeFetch<{ id: string; email: string }>(token, "/account");
  return { connected: true as const, accountId: account.id, email: account.email, mode: token.startsWith("sk_live_") ? "live" : "test" };
}

export async function listStripeProducts(userId: string, limit = 20) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<{ data: unknown[] }>(token, `/products?limit=${limit}&active=true`);
}

export async function listStripePrices(userId: string, productId?: string, limit = 20) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  const q = productId ? `&product=${encodeURIComponent(productId)}` : "";
  return stripeFetch<{ data: unknown[] }>(token, `/prices?limit=${limit}${q}`);
}

export async function createStripeProductWithPrice(
  userId: string,
  input: { name: string; description?: string; unitAmount: number; currency: string; recurring?: "month" | "year" | null },
) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  const product = await stripeFetch<{ id: string; name: string }>(token, "/products", {
    method: "POST",
    form: { name: input.name, description: input.description },
  });
  const price = await stripeFetch<{ id: string; unit_amount: number; currency: string }>(token, "/prices", {
    method: "POST",
    form: {
      product: product.id,
      currency: input.currency,
      unit_amount: input.unitAmount,
      recurring: input.recurring ? { interval: input.recurring } : undefined,
    },
  });
  return { product, price };
}

export async function createStripeCheckoutSession(
  userId: string,
  input: { priceId: string; quantity?: number; successUrl: string; cancelUrl: string; mode?: "payment" | "subscription"; customerEmail?: string },
) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<{ id: string; url: string }>(token, "/checkout/sessions", {
    method: "POST",
    form: {
      mode: input.mode ?? "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: input.customerEmail,
      line_items: [{ price: input.priceId, quantity: input.quantity ?? 1 }],
    },
  });
}

export async function createStripePaymentLink(userId: string, input: { priceId: string; quantity?: number }) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<{ id: string; url: string; active: boolean }>(token, "/payment_links", {
    method: "POST",
    form: { line_items: [{ price: input.priceId, quantity: input.quantity ?? 1 }] },
  });
}

export async function listStripeCustomers(userId: string, limit = 20, email?: string) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  const q = email ? `&email=${encodeURIComponent(email)}` : "";
  return stripeFetch<{ data: unknown[] }>(token, `/customers?limit=${limit}${q}`);
}

export async function listStripeRecentPayments(userId: string, limit = 20) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<{ data: unknown[] }>(token, `/payment_intents?limit=${limit}`);
}

export async function getStripeBalance(userId: string) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<unknown>(token, "/balance");
}

export async function refundStripePayment(userId: string, paymentIntentId: string, amount?: number) {
  const token = await resolveProviderKey("stripe", userId);
  if (!token) throw new Error("Stripe key not configured");
  return stripeFetch<unknown>(token, "/refunds", {
    method: "POST",
    form: { payment_intent: paymentIntentId, amount },
  });
}
