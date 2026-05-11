import { NextRequest } from "next/server";

const OPERON_API_URL =
  process.env.NEXT_PUBLIC_OPERON_API_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8080";

export async function resolveUserId(req: NextRequest): Promise<string | null> {
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
