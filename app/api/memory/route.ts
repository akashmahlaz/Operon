import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { memory } from "@/lib/memory";
import { appendLog } from "@/lib/services/logs";

/**
 * GET  /api/memory?q=...   — search memory facts
 * POST /api/memory         — add a memory fact { content, source? }
 */

const MEMORY_KINDS = new Set(["preference", "fact", "project", "instruction"]);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id || session.user.email || "anon";
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const results = q ? await memory.search(userId, q) : await memory.list(userId);
  return NextResponse.json({ results });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id || session.user.email || "anon";
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await memory.remove(userId, id);
  await appendLog({ userId, level: "info", source: "memory", message: "Memory removed", metadata: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id || session.user.email || "anon";
  const body = await req.json();
  if (!body?.content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const kind = typeof body.kind === "string" && MEMORY_KINDS.has(body.kind) ? body.kind : undefined;
  const importance = typeof body.importance === "number" ? body.importance : undefined;
  const fact = await memory.add(userId, {
    content: body.content,
    source: body.source,
    kind,
    importance,
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith("Memory cannot store")) {
      return null;
    }
    throw error;
  });
  if (!fact) return NextResponse.json({ error: "memory cannot store credentials or secrets" }, { status: 400 });
  await appendLog({ userId, level: "info", source: "memory", message: "Memory added", metadata: { source: body.source || "manual" } });
  return NextResponse.json({ fact });
}
