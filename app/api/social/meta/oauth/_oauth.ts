import crypto from "crypto";

const META_GRAPH = "https://graph.facebook.com/v21.0";
const META_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

interface OAuthStatePayload {
  u: string;
  r: string;
  t: number;
}

function oauthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "operon-development-secret";
  return secret;
}

function metaAppId() {
  return process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "";
}

function metaAppSecret() {
  return process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "";
}

function sign(content: string) {
  return crypto.createHmac("sha256", oauthSecret()).update(content).digest("base64url");
}

export function ensureMetaOAuthConfig() {
  if (!metaAppId() || !metaAppSecret()) {
    throw new Error("Missing META_APP_ID/META_APP_SECRET configuration");
  }
}

export function normalizeRedirectPath(path: string | null | undefined) {
  if (!path) return "/dashboard/social/facebook";
  if (!path.startsWith("/")) return "/dashboard/social/facebook";
  if (path.startsWith("//")) return "/dashboard/social/facebook";
  return path;
}

export function buildMetaAuthUrl(params: { redirectUri: string; state: string }) {
  ensureMetaOAuthConfig();
  const url = new URL(META_DIALOG);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  url.searchParams.set(
    "scope",
    [
      "ads_management",
      "ads_read",
      "business_management",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
    ].join(","),
  );
  return url.toString();
}

export function encodeOAuthState(payload: { userId: string; redirectPath: string }) {
  const body: OAuthStatePayload = {
    u: payload.userId,
    r: normalizeRedirectPath(payload.redirectPath),
    t: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function decodeOAuthState(state: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) throw new Error("Invalid OAuth state");

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid OAuth state signature");
  }

  const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthStatePayload;
  if (!parsed.u || !parsed.r || !parsed.t) throw new Error("Invalid OAuth state payload");
  if (Date.now() - parsed.t > STATE_MAX_AGE_MS) throw new Error("OAuth state expired");

  return { userId: parsed.u, redirectPath: normalizeRedirectPath(parsed.r) };
}

async function fetchToken(url: URL) {
  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Meta OAuth token exchange failed: ${response.status} ${text}`);
  }
  return response.json() as Promise<{ access_token: string; token_type?: string; expires_in?: number }>;
}

export async function exchangeCodeForMetaToken(code: string, redirectUri: string) {
  ensureMetaOAuthConfig();

  const shortUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", metaAppId());
  shortUrl.searchParams.set("client_secret", metaAppSecret());
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);
  const shortToken = await fetchToken(shortUrl);

  const longUrl = new URL(`${META_GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", metaAppId());
  longUrl.searchParams.set("client_secret", metaAppSecret());
  longUrl.searchParams.set("fb_exchange_token", shortToken.access_token);

  try {
    const longToken = await fetchToken(longUrl);
    return longToken.access_token;
  } catch {
    return shortToken.access_token;
  }
}
