/**
 * /api/coding — proxy from the Next.js app to the operonx Rust runtime.
 *
 *   POST /api/coding                     create + stream a run
 *   GET  /api/coding?run_id=&last_seq=   tail/resume an existing run
 *   POST /api/coding/cancel?run_id=...   cancel a run
 *
 * Auth flow:
 *   1. NextAuth session is required.
 *   2. The session email is exchanged for an operonx JWT via
 *      `POST /auth/internal/exchange` (gated by OPERON_INTERNAL_SECRET).
 *      The JWT is cached in-process for ~50 minutes per user.
 *   3. Every operonx call uses `Authorization: Bearer <jwt>`.
 *
 * The Rust runtime emits SSE frames in the envelope shape that
 * `useStreamEvents` expects — no protocol translation needed; we just pipe
 * the response body through.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const RUST_API_URL = process.env.OPERON_API_URL ?? "http://127.0.0.1:8080";
const INTERNAL_SECRET = process.env.OPERON_INTERNAL_SECRET ?? "";

interface CachedToken {
  token: string;
  expiresAt: number;
}
const tokenCache = new Map<string, CachedToken>();

async function operonTokenFor(email: string, displayName?: string | null): Promise<string> {
  if (!INTERNAL_SECRET) {
    throw new Error("OPERON_INTERNAL_SECRET is not configured");
  }
  const cached = tokenCache.get(email);
  // 60s safety margin
  if (cached && cached.expiresAt > Date.now() / 1000 + 60) {
    return cached.token;
  }
  const res = await fetch(`${RUST_API_URL}/auth/internal/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Operon-Internal-Secret": INTERNAL_SECRET,
    },
    body: JSON.stringify({ email, display_name: displayName ?? null }),
  });
  if (!res.ok) {
    throw new Error(`operonx auth exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_at: number };
  tokenCache.set(email, { token: json.access_token, expiresAt: json.expires_at });
  return json.access_token;
}

async function requireToken(): Promise<{ token: string } | NextResponse> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const token = await operonTokenFor(email, session?.user?.name);
    return { token };
  } catch (err) {
    return NextResponse.json(
      { error: "auth_exchange_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}

interface IncomingBody {
  prompt?: string;
  message?: string;
  messages?: Array<{ role: string; content?: string; parts?: unknown[] }>;
  conversationId?: string;
  conversation_id?: string;
  model?: string;
  workspace?: string;
}

function extractPrompt(body: IncomingBody): string {
  if (typeof body.prompt === "string" && body.prompt.trim()) return body.prompt;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  const last = body.messages?.slice().reverse().find((m) => m.role === "user");
  if (!last) return "";
  if (typeof last.content === "string") return last.content;
  if (Array.isArray(last.parts)) {
    return last.parts
      .map((p) =>
        typeof p === "object" && p && "text" in p
          ? String((p as { text: unknown }).text ?? "")
          : "",
      )
      .join("");
  }
  return "";
}

export async function POST(req: Request) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { token } = tokenOrResponse;

  let body: IncomingBody = {};
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const prompt = extractPrompt(body);
  if (!prompt.trim()) {
    return NextResponse.json({ error: "prompt_required" }, { status: 400 });
  }

  const createRes = await fetch(`${RUST_API_URL}/agent/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      model: body.model,
      conversation_id: body.conversationId ?? body.conversation_id,
      workspace: body.workspace,
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    return new Response(text, { status: createRes.status });
  }

  const created = (await createRes.json()) as {
    run_id: string;
    conversation_id: string;
  };

  const sseRes = await fetch(`${RUST_API_URL}/agent/runs/${created.run_id}/sse`, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!sseRes.ok || !sseRes.body) {
    const text = await sseRes.text().catch(() => "stream_failed");
    return new Response(text, { status: sseRes.status || 502 });
  }

  return new Response(sseRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Run-Id": created.run_id,
      "X-Conversation-Id": created.conversation_id,
    },
  });
}

export async function GET(req: Request) {
  const tokenOrResponse = await requireToken();
  if (tokenOrResponse instanceof NextResponse) return tokenOrResponse;
  const { token } = tokenOrResponse;

  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id");
  if (!runId) {
    return NextResponse.json({ error: "run_id_required" }, { status: 400 });
  }
  const lastSeq = url.searchParams.get("last_seq");

  const target = new URL(`${RUST_API_URL}/agent/runs/${runId}/sse`);
  if (lastSeq) target.searchParams.set("last_seq", lastSeq);

  const sseRes = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!sseRes.ok || !sseRes.body) {
    const text = await sseRes.text().catch(() => "stream_failed");
    return new Response(text, { status: sseRes.status || 502 });
  }

  return new Response(sseRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
