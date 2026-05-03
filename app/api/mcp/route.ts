import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listMcpServers, upsertMcpServer, deleteMcpServer } from "@/lib/ai/mcp-client";
import { appendLog } from "@/lib/services/logs";
import type { Session } from "next-auth";

function resolveUserId(session: Session | null) {
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || session.user.email || null;
}

export async function GET() {
  const session = await auth();
  const uid = resolveUserId(session);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ servers: await listMcpServers(uid) });
}

export async function POST(req: Request) {
  const session = await auth();
  const uid = resolveUserId(session);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.url) return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  try { new URL(body.url); } catch { return NextResponse.json({ error: "invalid url" }, { status: 400 }); }
  const server = await upsertMcpServer(uid, { id: body.id, name: body.name, url: body.url, enabled: body.enabled });
  await appendLog({ userId: uid, level: "info", source: "mcp", message: "MCP server saved", metadata: { name: body.name } });
  return NextResponse.json({ server });
}

export async function DELETE(req: Request) {
  const session = await auth();
  const uid = resolveUserId(session);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteMcpServer(uid, id);
  await appendLog({ userId: uid, level: "info", source: "mcp", message: "MCP server deleted", metadata: { id } });
  return NextResponse.json({ ok: true });
}
