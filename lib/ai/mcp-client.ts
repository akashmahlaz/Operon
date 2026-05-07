import { tool } from "ai";
import type { Tool } from "ai";
import { z } from "zod";
import { collections } from "@/lib/db-collections";
import { appendLog } from "@/lib/services/logs";
import type { Document } from "mongodb";

export interface McpServer extends Document {
  id: string;
  userId: string;
  name: string;
  url: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const mcpServers = () => collections.mcpServers<McpServer>();

let indexReady: Promise<void> | null = null;
function ensureIndex() {
  indexReady ??= mcpServers().createIndex({ userId: 1 }, {}).then(() => undefined);
  return indexReady;
}

export async function listMcpServers(userId: string) {
  await ensureIndex();
  return mcpServers().find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function upsertMcpServer(userId: string, server: { id?: string; name: string; url: string; enabled?: boolean }) {
  await ensureIndex();
  const now = new Date().toISOString();
  const id = server.id ?? crypto.randomUUID();
  await mcpServers().updateOne(
    { userId, id },
    {
      $set: { name: server.name.trim(), url: server.url.trim(), enabled: server.enabled !== false, updatedAt: now },
      $setOnInsert: { _id: id, id, userId, createdAt: now },
    },
    { upsert: true },
  );
  return mcpServers().findOne({ userId, id });
}

export async function deleteMcpServer(userId: string, id: string) {
  await ensureIndex();
  await mcpServers().deleteOne({ userId, id });
}

// MCP JSON-RPC 2.0 over HTTP (streamable HTTP transport)

interface McpRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: number;
}

interface McpRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: { code: number; message: string };
  id: number;
}

async function mcpRpc<T>(url: string, method: string, params?: unknown): Promise<T> {
  const body: McpRpcRequest = { jsonrpc: "2.0", method, params: params ?? {}, id: 1 };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`MCP server returned HTTP ${response.status}`);
  const data = (await response.json()) as McpRpcResponse<T>;
  if (data.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
  return data.result as T;
}

interface McpToolDef {
  name: string;
  description?: string;
}

/** Build AI SDK tool objects for all enabled MCP servers. Silently skips unreachable servers. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMcpTools(userId: string): Promise<Record<string, Tool<any, any>>> {
  const servers = await listMcpServers(userId).catch(() => [] as McpServer[]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: Record<string, Tool<any, any>> = {};

  for (const server of servers.filter((s) => s.enabled)) {
    try {
      const data = await mcpRpc<{ tools?: McpToolDef[] }>(server.url, "tools/list");
      const toolList = data?.tools ?? [];
      for (const toolDef of toolList) {
        const toolName = `mcp_${server.name.toLowerCase().replace(/\W+/g, "_")}_${toolDef.name}`;
        const serverUrl = server.url;
        const toolDefName = toolDef.name;

        result[toolName] = tool({
          description: toolDef.description ?? toolDef.name,
          inputSchema: z.record(z.string(), z.unknown()),
          execute: async (args: Record<string, unknown>) => {
            await appendLog({ userId, level: "info", source: "mcp", message: `MCP tool called: ${toolDefName}`, metadata: { server: server.name, tool: toolDefName } });
            return mcpRpc(serverUrl, "tools/call", { name: toolDefName, arguments: args });
          },
        });
      }
    } catch (error) {
      await appendLog({ userId, level: "warn", source: "mcp", message: `MCP server unreachable: ${server.name}`, metadata: { url: server.url, error: error instanceof Error ? error.message : String(error) } });
    }
  }

  return result;
}
