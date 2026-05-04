import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listAgents, createAgent, updateAgent, deleteAgent } from "@/lib/services/agents";
import type { Agent } from "@/lib/types";

async function userIdOf(): Promise<string | null> {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || session.user.email || null;
}

export async function GET() {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const agents = await listAgents(userId);
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Partial<Omit<Agent, "id">>;
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const agent = await createAgent(userId, {
    name: body.name.trim(),
    description: body.description ?? "",
    systemPrompt: body.systemPrompt ?? "",
    tools: Array.isArray(body.tools) ? body.tools : [],
    enabled: body.enabled ?? true,
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json(agent, { status: 201 });
}

export async function PATCH(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Partial<Omit<Agent, "id">>;
  const agent = await updateAgent(userId, id, body);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteAgent(userId, id);
  return NextResponse.json({ ok: true });
}
