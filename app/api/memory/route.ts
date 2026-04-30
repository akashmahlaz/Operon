import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { memory } from "@/lib/memory";

/**
 * GET  /api/memory?q=...   — search memory facts
 * POST /api/memory         — add a memory fact { content, source? }
 */

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const results = q ? await memory.search(q) : await memory.list();
  return NextResponse.json({ results });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body?.content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const fact = await memory.add({ content: body.content, source: body.source });
  return NextResponse.json({ fact });
}
