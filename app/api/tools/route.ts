import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getToolStatuses } from "@/lib/ai/tools/registry";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as { id?: string }).id || session.user.email || "anon";
  return NextResponse.json({ tools: await getToolStatuses(userId) });
}
