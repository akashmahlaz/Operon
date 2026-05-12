import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/services/logs";
import { validateAndStoreMetaToken } from "@/lib/services/meta-ads";
import { decodeOAuthState, exchangeCodeForMetaToken } from "@/app/api/social/meta/oauth/_oauth";

function buildRedirect(origin: string, path: string, params?: Record<string, string>) {
  const url = new URL(path, origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();
  const oauthError = url.searchParams.get("error")?.trim();
  const oauthErrorReason = url.searchParams.get("error_description")?.trim() || oauthError || "oauth_failed";

  if (!state) {
    return NextResponse.redirect(buildRedirect(url.origin, "/dashboard/social/facebook", { error: "missing_oauth_state" }));
  }

  let userId = "";
  let redirectPath = "/dashboard/social/facebook";
  try {
    const parsed = decodeOAuthState(state);
    userId = parsed.userId;
    redirectPath = parsed.redirectPath;
  } catch {
    return NextResponse.redirect(buildRedirect(url.origin, "/dashboard/social/facebook", { error: "invalid_oauth_state" }));
  }

  if (oauthError) {
    await appendLog({
      userId,
      level: "warn",
      source: "social-meta-oauth",
      message: "Meta OAuth denied",
      metadata: { oauthError, oauthErrorReason },
    });
    return NextResponse.redirect(buildRedirect(url.origin, redirectPath, { error: oauthErrorReason }));
  }

  if (!code) {
    return NextResponse.redirect(buildRedirect(url.origin, redirectPath, { error: "missing_oauth_code" }));
  }

  try {
    const callbackUrl = new URL("/api/social/meta/oauth/callback", url.origin).toString();
    const token = await exchangeCodeForMetaToken(code, callbackUrl);
    await validateAndStoreMetaToken(userId, token);

    await appendLog({
      userId,
      level: "info",
      source: "social-meta-oauth",
      message: "Meta OAuth connected",
      metadata: { redirectPath },
    });

    return NextResponse.redirect(buildRedirect(url.origin, redirectPath, { connected: "meta" }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "oauth_callback_failed";

    await appendLog({
      userId,
      level: "error",
      source: "social-meta-oauth",
      message: "Meta OAuth callback failed",
      metadata: { error: message },
    });

    return NextResponse.redirect(buildRedirect(url.origin, redirectPath, { error: message }));
  }
}
