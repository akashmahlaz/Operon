import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * GET  /api/conversations           — list current user's conversations
 * POST /api/conversations           — create a new conversation
 *
 * Stubbed for now. Hook into `collections.conversations()` once we
 * settle on the document shape.
 */

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ conversations: [] });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    id: crypto.randomUUID(),
    title: body?.title ?? "New conversation",
    channel: body?.channel ?? "web",
    messageCount: 0,
    updatedAt: new Date().toISOString(),
  });
}
