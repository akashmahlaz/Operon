import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { appendMessage, createConversation, deleteConversation, getConversation, listConversations } from "@/lib/services/chat-store";
import type { Channel } from "@/lib/types";

async function userIdOf() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || session.user.email || "anon";
}

export async function GET(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json([], { status: 200 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) {
    const conversation = await getConversation(id, userId);
    if (!conversation) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(conversation);
  }

  return NextResponse.json(await listConversations(userId));
}

export async function PUT(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await createConversation({
    userId,
    title: typeof body?.title === "string" ? body.title : "New Chat",
    channel: typeof body?.channel === "string" ? (body.channel as Channel) : "web",
  }));
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteConversation(id, userId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  // Internal: append a message to a conversation (called from /api/chat).
  const body = await req.json().catch(() => ({}));
  const { id, message } = body || {};
  if (!id || !message) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await appendMessage(id, userId, {
    role: message.role,
    content: typeof message.content === "string" ? message.content : "",
    parts: Array.isArray(message.parts) ? message.parts : [],
    createdAt: typeof message.createdAt === "string" ? message.createdAt : new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

