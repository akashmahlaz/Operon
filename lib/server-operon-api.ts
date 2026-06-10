import "server-only";

const OPERON_API_URL =
  process.env.OPERON_API_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_OPERON_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8080";

const INTERNAL_SECRET =
  process.env.OPERON_INTERNAL_SECRET || "operon-development-secret";

export async function operonServerJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-operon-internal-secret", INTERNAL_SECRET);

  const res = await fetch(`${OPERON_API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Rust API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}
