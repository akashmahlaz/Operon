import { NextRequest, NextResponse } from "next/server";
import { listAgentSkills } from "@/lib/services/agent-skills";

const OPERON_API_URL =
  process.env.NEXT_PUBLIC_OPERON_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8080";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const res = await fetch(`${OPERON_API_URL}/auth/me`, {
      headers: { Authorization: auth },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: string };
    return user.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const skills = await listAgentSkills(userId);
  return NextResponse.json({ skills });
}
