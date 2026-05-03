import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPersona, setPersona } from "@/lib/services/user-settings";
import { appendLog } from "@/lib/services/logs";

async function userIdOf() {
  const session = await auth();
  if (!session?.user) return null;
  return (session.user as { id?: string }).id || session.user.email || null;
}

export async function GET() {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ persona: await getPersona(userId) });
}

export async function PUT(req: Request) {
  const userId = await userIdOf();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const persona = await setPersona(userId, body);
  await appendLog({
    userId,
    level: "info",
    source: "persona",
    message: "Persona updated",
    metadata: { style: persona.communicationStyle, language: persona.languagePreference },
  });
  return NextResponse.json({ persona });
}
