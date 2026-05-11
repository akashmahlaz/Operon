/**
 * Twilio Programmable SMS service.
 *
 * Twilio uses Basic Auth (AccountSid:AuthToken). We store both as a single
 * encrypted blob `accountSid:authToken` under provider="twilio" type="api_key"
 * so the existing single-token storage shape works without schema changes.
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

function splitCreds(stored: string): { sid: string; token: string } {
  const idx = stored.indexOf(":");
  if (idx <= 0) throw new Error("malformed Twilio credentials in storage");
  return { sid: stored.slice(0, idx), token: stored.slice(idx + 1) };
}

async function twilioFetch<T>(userId: string, path: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<T> {
  const stored = await resolveProviderKey("twilio", userId);
  if (!stored) throw notConnectedError("twilio", "Twilio");
  const { sid, token } = splitCreds(stored);
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const headers: Record<string, string> = { Authorization: `Basic ${auth}` };
  let body: BodyInit | undefined;
  if (init.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  }
  const url = path.replace("{Sid}", sid);
  const res = await fetch(`${TWILIO_API}${url}`, { method: init.method ?? "GET", headers, body });
  const json = (await res.json().catch(() => ({}))) as { message?: string; [k: string]: unknown };
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${json.message ?? res.statusText}`);
  return json as T;
}

export async function validateAndStoreTwilioCreds(userId: string, accountSid: string, authToken: string) {
  if (!accountSid.startsWith("AC")) throw new Error("AccountSid must start with 'AC'");
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(`${TWILIO_API}/Accounts/${accountSid}.json`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio credential validation failed (${res.status})`);
  await upsertAuthProfile({
    userId, provider: "twilio", type: "api_key",
    token: `${accountSid}:${authToken}`,
    metadata: { accountSid },
  });
  return { saved: true, accountSid };
}

export async function getTwilioStatus(userId: string) {
  try {
    const stored = await resolveProviderKey("twilio", userId);
    if (!stored) return { connected: false };
    const { sid } = splitCreds(stored);
    return { connected: true, accountSid: sid };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendTwilioSms(userId: string, params: { from: string; to: string; body: string }) {
  return twilioFetch<{ sid: string; status: string; to: string; from: string }>(
    userId, `/Accounts/{Sid}/Messages.json`,
    { method: "POST", form: { From: params.from, To: params.to, Body: params.body } },
  );
}

export async function listTwilioMessages(userId: string, limit: number = 20) {
  return twilioFetch<{ messages: unknown[] }>(userId, `/Accounts/{Sid}/Messages.json?PageSize=${limit}`);
}
