import { NextRequest, NextResponse } from "next/server";
import { buildAvailableTools } from "@/lib/ai/tools/registry";
import { appendLog } from "@/lib/services/logs";
import { ToolError } from "@/lib/services/tool-errors";

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

interface ExecuteBody {
  tool: string;
  args?: Record<string, unknown>;
  channel?: string;
  conversationId?: string | null;
}

interface ExecutableTool {
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
  inputSchema?: { safeParse?: (input: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown[] } } };
}

/**
 * Single-shot tool execution endpoint. Resolves the user via the operon JWT,
 * builds the tool catalog respecting channel + connected providers, validates
 * input via the tool's Zod schema, executes, and returns the JSON result.
 *
 * Designed so the Rust `operonx` backend (or any external orchestrator) can
 * delegate tool calls to the Next process where every connector is implemented.
 */
export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.tool || typeof body.tool !== "string") {
    return NextResponse.json({ error: "missing_tool_name" }, { status: 400 });
  }

  const tools = await buildAvailableTools(userId, {
    channel: body.channel ?? "web",
    conversationId: body.conversationId ?? null,
  });
  const tool = tools[body.tool] as ExecutableTool | undefined;
  if (!tool || typeof tool.execute !== "function") {
    return NextResponse.json({ error: "tool_not_available", tool: body.tool }, { status: 404 });
  }

  let parsedArgs: Record<string, unknown> = body.args ?? {};
  const schema = tool.inputSchema;
  if (schema?.safeParse) {
    const result = schema.safeParse(parsedArgs);
    if (!result.success) {
      return NextResponse.json(
        { error: "invalid_args", issues: result.error?.issues ?? [] },
        { status: 400 },
      );
    }
    parsedArgs = (result.data as Record<string, unknown>) ?? parsedArgs;
  }

  try {
    const output = await tool.execute(parsedArgs);
    await appendLog({
      userId,
      level: "info",
      source: "tool-execute",
      message: `Tool executed: ${body.tool}`,
      metadata: { tool: body.tool, channel: body.channel ?? "web" },
    });
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    if (err instanceof ToolError) {
      await appendLog({
        userId,
        level: "warn",
        source: "tool-execute",
        message: `Tool error (${err.kind}): ${body.tool}`,
        metadata: { tool: body.tool, kind: err.kind, provider: err.provider },
      });
      // Return 200 so the model receives the structured payload cleanly and
      // can render an actionable affordance instead of a raw 500.
      return NextResponse.json(err.toJSON());
    }
    const message = err instanceof Error ? err.message : String(err);
    await appendLog({
      userId,
      level: "error",
      source: "tool-execute",
      message: `Tool failed: ${body.tool}`,
      metadata: { tool: body.tool, error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
