import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/services/logs";
import { resolveUserId, resolveUserIdFromAccessToken } from "@/app/api/social/meta/_auth";
import {
  buildMetaAuthUrl,
  encodeOAuthState,
  normalizeRedirectPath,
} from "@/app/api/social/meta/oauth/_oauth";

interface OAuthStartBody {
  redirect?: string;
}

async function buildStartResponse(userId: string, origin: string, redirectRaw: string | null) {
  const redirectPath = normalizeRedirectPath(redirectRaw);
  const callbackUrl = new URL("/api/social/meta/oauth/callback", origin).toString();
  const state = encodeOAuthState({ userId, redirectPath });
  const authUrl = buildMetaAuthUrl({ redirectUri: callbackUrl, state });

  await appendLog({
    userId,
    level: "info",
    source: "social-meta-oauth",
    message: "Meta OAuth start",
    metadata: { redirectPath },
  });

  return { authUrl };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const bearerUserId = await resolveUserId(req);
  const token = url.searchParams.get("token")?.trim() ?? "";
  const tokenUserId = !bearerUserId && token ? await resolveUserIdFromAccessToken(token) : null;
  const userId = bearerUserId ?? tokenUserId;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { authUrl } = await buildStartResponse(userId, url.origin, url.searchParams.get("redirect"));
    return NextResponse.redirect(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_start_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: OAuthStartBody = {};
  try {
    body = (await req.json()) as OAuthStartBody;
  } catch {
    body = {};
  }

  try {
    const { authUrl } = await buildStartResponse(userId, new URL(req.url).origin, body.redirect ?? null);
    return NextResponse.json({ authUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_start_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
