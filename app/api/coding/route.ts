/**
 * Coding channel proxy → operonx (Rust runtime).
 *
 * - POST  /api/coding         → creates a run on operonx and streams its SSE
 *                               output back as the response body (AI SDK v5
 *                               UIMessageStream protocol; useChat-compatible).
 * - GET   /api/coding?run_id= → tails the SSE stream of an existing run.
 *
 * Auth: forwards the `operon_access_token` cookie or `Authorization: Bearer`
 * header straight through to operonx. Sign in against operonx /auth/login to
 * obtain that token.
 */

const RUST_API_URL = process.env.OPERON_API_URL ?? "http://127.0.0.1:8080";

function pickAuthHeaders(req: Request): HeadersInit {
  const out: Record<string, string> = {};
  const auth = req.headers.get("authorization");
  if (auth) out.Authorization = auth;
  const cookie = req.headers.get("cookie");
  if (cookie) out.Cookie = cookie;
  return out;
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
      .map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text: unknown }).text ?? "") : ""))
      .join("");
  }
  return "";
}

export async function POST(req: Request) {
  let body: IncomingBody = {};
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const prompt = extractPrompt(body);
  if (!prompt.trim()) {
    return new Response("prompt is required", { status: 400 });
  }

  const createRes = await fetch(`${RUST_API_URL}/agent/runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...pickAuthHeaders(req),
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

  const sseRes = await fetch(
    `${RUST_API_URL}/agent/runs/${created.run_id}/sse`,
    {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...pickAuthHeaders(req),
      },
    },
  );

  if (!sseRes.ok || !sseRes.body) {
    const text = await sseRes.text().catch(() => "stream failed");
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
  const url = new URL(req.url);
  const runId = url.searchParams.get("run_id");
  if (!runId) {
    return new Response("run_id is required", { status: 400 });
  }
  const lastSeq = url.searchParams.get("last_seq");

  const target = new URL(`${RUST_API_URL}/agent/runs/${runId}/sse`);
  if (lastSeq) target.searchParams.set("last_seq", lastSeq);

  const sseRes = await fetch(target, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      ...pickAuthHeaders(req),
    },
  });

  if (!sseRes.ok || !sseRes.body) {
    const text = await sseRes.text().catch(() => "stream failed");
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
