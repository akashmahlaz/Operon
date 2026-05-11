import { NextRequest, NextResponse } from "next/server";
import { validateAndStoreMetaToken } from "@/lib/services/meta-ads";
import { appendLog } from "@/lib/services/logs";
import { resolveUserId } from "@/app/api/social/meta/_auth";

interface ConnectBody {
  token?: string;
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ConnectBody;
  try {
    body = (await req.json()) as ConnectBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  try {
    const result = await validateAndStoreMetaToken(userId, token);
    await appendLog({
      userId,
      level: "info",
      source: "social-meta",
      message: "Connected Meta account",
      metadata: { provider: "meta", metaUserId: result.user.id },
    });
    return NextResponse.json({ ok: true, user: result.user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_connect_meta";
    await appendLog({
      userId,
      level: "warn",
      source: "social-meta",
      message: "Meta connection failed",
      metadata: { provider: "meta", error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
