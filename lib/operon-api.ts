"use client";

export const OPERON_API_URL =
  process.env.NEXT_PUBLIC_OPERON_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8080";

const TOKEN_KEY = "operon_access_token";
const EXPIRES_KEY = "operon_access_token_expires_at";
const USER_KEY = "operon_user";

export interface OperonUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  display_name?: string | null;
}

export interface OperonAuthResponse {
  user: OperonUser;
  access_token: string;
  expires_at: number;
}

export function operonToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const expiresAt = Number(window.localStorage.getItem(EXPIRES_KEY) ?? "0");
  if (!token) return null;
  if (expiresAt && expiresAt <= Math.floor(Date.now() / 1000)) {
    clearOperonSession();
    return null;
  }
  return token;
}

export function operonUser(): OperonUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OperonUser;
  } catch {
    return null;
  }
}

export function saveOperonSession(auth: OperonAuthResponse) {
  window.localStorage.setItem(TOKEN_KEY, auth.access_token);
  window.localStorage.setItem(EXPIRES_KEY, String(auth.expires_at));
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  window.dispatchEvent(new Event("operon-auth-change"));
}

export function clearOperonSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EXPIRES_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("operon-auth-change"));
}

export async function operonFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = operonToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${OPERON_API_URL}${path}`, {
    ...init,
    headers,
  });
}

export async function operonJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await operonFetch(path, init);
  if (!res.ok) {
    throw new Error(`Rust API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function operonLogin(email: string, password: string) {
  const auth = await operonJson<OperonAuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveOperonSession(auth);
  return auth;
}

export async function operonSignup(displayName: string, email: string, password: string) {
  const auth = await operonJson<OperonAuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, email, password }),
  });
  saveOperonSession(auth);
  return auth;
}

export async function operonMe() {
  return operonJson<OperonUser>("/auth/me");
}

export function operonGoogleOAuthUrl() {
  return `${OPERON_API_URL}/auth/oauth/google`;
}
