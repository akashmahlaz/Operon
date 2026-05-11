/**
 * Resend transactional email API. Stores `re_…` API key under
 * provider="resend" type="api_key".
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const RESEND_API = "https://api.resend.com";

async function resendFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const tk = await resolveProviderKey("resend", userId);
  if (!tk) throw notConnectedError("resend", "Resend");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tk}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${RESEND_API}${path}`, { ...init, headers });
  const json = (await res.json().catch(() => ({}))) as { message?: string; name?: string; [k: string]: unknown };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${json.message ?? res.statusText}`);
  return json as T;
}

export async function validateAndStoreResendKey(userId: string, apiKey: string) {
  const res = await fetch(`${RESEND_API}/domains`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Resend key validation failed (${res.status})`);
  await upsertAuthProfile({ userId, provider: "resend", type: "api_key", token: apiKey });
  return { saved: true };
}

export async function getResendStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("resend", userId);
    if (!tk) return { connected: false };
    await resendFetch(userId, "/domains");
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendResendEmail(userId: string, params: {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}) {
  return resendFetch<{ id: string }>(userId, "/emails", {
    method: "POST",
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
      cc: params.cc,
      bcc: params.bcc,
    }),
  });
}

export async function listResendDomains(userId: string) {
  return resendFetch<{ data: Array<{ id: string; name: string; status: string; region: string }> }>(userId, "/domains");
}

export async function createResendDomain(userId: string, name: string, region: string = "us-east-1") {
  return resendFetch<{ id: string; name: string; status: string }>(userId, "/domains", {
    method: "POST", body: JSON.stringify({ name, region }),
  });
}
