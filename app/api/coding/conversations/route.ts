/**
 * Coding conversations proxy → operonx.
 *
 *   GET /api/coding/conversations          list user's coding conversations
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const RUST_API_URL = process.env.OPERON_API_URL ?? "http://127.0.0.1:8080";
const INTERNAL_SECRET = process.env.OPERON_INTERNAL_SECRET ?? "";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function operonTokenFor(email: string, displayName?: string | null): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached && cached.expiresAt > Date.now() / 1000 + 60) return cached.token;
  const res = await fetch(`${RUST_API_URL}/auth/internal/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Operon-Internal-Secret": INTERNAL_SECRET,
    },
    body: JSON.stringify({ email, display_name: displayName ?? null }),
  });
  if (!res.ok) throw new Error(`auth_exchange_failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_at: number };
  tokenCache.set(email, { token: json.access_token, expiresAt: json.expires_at });
  return json.access_token;
}

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!INTERNAL_SECRET) {
    return NextResponse.json({ error: "internal_secret_missing" }, { status: 500 });
  }
  const token = await operonTokenFor(email, session.user?.name);
  const res = await fetch(`${RUST_API_URL}/agent/conversations`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
