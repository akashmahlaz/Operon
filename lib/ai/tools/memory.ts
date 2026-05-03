import { tool } from "ai";
import { z } from "zod";
import { memory } from "@/lib/memory";
import { appendLog } from "@/lib/services/logs";

export function createMemoryTools(userId: string) {
  return {
    memory_search: tool({
      description: "Search the user's long-term memory for preferences, stable facts, and previous decisions.",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ query, limit }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Memory searched", metadata: { tool: "memory_search", query } });
        return { memories: await memory.search(userId, query, limit ?? 8) };
      },
    }),
    memory_remember: tool({
      description: "Store a durable user preference or important fact. Do not store passwords, tokens, API keys, or short-lived secrets.",
      inputSchema: z.object({
        content: z.string().min(3).max(1000),
        source: z.string().optional(),
        kind: z.enum(["preference", "fact", "project", "instruction"]).optional(),
        importance: z.number().int().min(1).max(5).optional(),
      }),
      execute: async ({ content, source, kind, importance }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Memory stored", metadata: { tool: "memory_remember", source: source || "chat", kind } });
        return { memory: await memory.add(userId, { content, source: source || "chat", kind, importance }) };
      },
    }),
  };
}