import { NextResponse } from "next/server";
import { auth } from "@/auth";

// In-memory store (per server process). Swap for MongoDB later.
type Msg = { role: "user" | "assistant" | "system"; content: string; createdAt: string; parts?: unknown[] };
type Conv = {
  _id: string;
  title: string;
  channel: "web" | "whatsapp" | "telegram";
  lastMessage: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Msg[];
  userId: string;
};

declare global {
  var __operon_convs: Map<string, Conv> | undefined;
}
const store: Map<string, Conv> = (globalThis.__operon_convs ??= new Map());

function summary(c: Conv) {
  const { messages: _msgs, ...rest } = c;
  void _msgs;
  return rest;
}

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
    const c = store.get(id);
    if (!c || c.userId !== userId) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(c);
  }

  const list = [...store.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
    .map(summary);
  return NextResponse.json(list);
}

export async function PUT(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const conv: Conv = {
    _id: id,
    title: body?.title || "New Chat",
    channel: body?.channel || "web",
    lastMessage: null,
    createdAt: now,
    updatedAt: now,
    messages: [],
    userId,
  };
  store.set(id, conv);
  return NextResponse.json(conv);
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const c = store.get(id);
  if (c && c.userId === userId) store.delete(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  // Internal: append a message to a conversation (called from /api/chat).
  const body = await req.json().catch(() => ({}));
  const { id, message } = body || {};
  if (!id || !message) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const conv = store.get(id);
  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 });
  conv.messages.push(message);
  conv.lastMessage = typeof message.content === "string" ? message.content.slice(0, 140) : null;
  conv.updatedAt = new Date().toISOString();
  if (conv.title === "New Chat" && message.role === "user" && message.content) {
    conv.title = message.content.slice(0, 60);
  }
  return NextResponse.json({ ok: true });
}

// Exposed for other routes in the same process (chat route persistence).
export function _getStore(): Map<string, Conv> {
  return store;
}

