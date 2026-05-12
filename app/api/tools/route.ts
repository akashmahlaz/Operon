import { NextRequest, NextResponse } from "next/server";
import { asSchema } from "ai";
import { buildAvailableTools, getToolStatuses, listToolDescriptors } from "@/lib/ai/tools/registry";

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
  const url = new URL(req.url);
  const channel = url.searchParams.get("channel") ?? "web";
  const conversationId = url.searchParams.get("conversationId");
  const includeSchemas = url.searchParams.get("schemas") === "true";

  const [statuses, builtTools] = await Promise.all([
    getToolStatuses(userId),
    buildAvailableTools(userId, { channel, conversationId }),
  ]);

  const descriptors = listToolDescriptors().map((d) => ({
    name: d.name,
    category: d.category,
    description: d.description,
    requires: d.requires ?? [],
    channels: d.channels ?? null,
  }));

  const tools = await Promise.all(
    Object.entries(builtTools).map(async ([name, t]) => {
      const inputSchema = (t as { inputSchema?: Parameters<typeof asSchema>[0] }).inputSchema;
      return {
        name,
        description: (t as { description?: string }).description ?? "",
        ...(includeSchemas
          ? { inputSchema: inputSchema ? await asSchema(inputSchema).jsonSchema : null }
          : {}),
      };
    }),
  );

  return NextResponse.json({ descriptors, statuses, tools });
}
