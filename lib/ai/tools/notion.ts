import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  appendNotionBlocks,
  createNotionPage,
  getNotionStatus,
  queryNotionDatabase,
  searchNotion,
  updateNotionPage,
  validateAndStoreNotionToken,
} from "@/lib/services/notion";

export function createNotionTools(userId: string) {
  return {
    notion_get_status: tool({
      description: "Check whether Notion is connected.",
      inputSchema: z.object({}),
      execute: async () => getNotionStatus(userId),
    }),
    notion_save_token: tool({
      description: "Securely store a Notion Internal Integration Secret (secret_…).",
      inputSchema: z.object({ token: z.string().min(20) }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Notion token save attempt", metadata: { tool: "notion_save_token" } });
        return validateAndStoreNotionToken(userId, token);
      },
    }),
    notion_search: tool({
      description: "Search across Notion pages and databases the integration can access.",
      inputSchema: z.object({
        query: z.string().min(1),
        filter: z.enum(["page", "database"]).optional(),
      }),
      execute: async ({ query, filter }) => searchNotion(userId, query, filter),
    }),
    notion_query_database: tool({
      description: "Query a Notion database by id with optional filter and sorts (Notion API shape).",
      inputSchema: z.object({
        databaseId: z.string().min(1),
        filter: z.unknown().optional(),
        sorts: z.array(z.unknown()).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ databaseId, filter, sorts, pageSize }) =>
        queryNotionDatabase(userId, databaseId, { filter, sorts, pageSize }),
    }),
    notion_create_page: tool({
      description: "Create a Notion page. Provide either {parent.database_id, properties} or {parent.page_id, title}.",
      inputSchema: z.object({
        parent: z.object({ database_id: z.string().optional(), page_id: z.string().optional() }),
        properties: z.record(z.string(), z.unknown()).optional(),
        children: z.array(z.unknown()).optional(),
        title: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Notion page created", metadata: { tool: "notion_create_page" } });
        return createNotionPage(userId, input);
      },
    }),
    notion_update_page: tool({
      description: "Update a Notion page's properties.",
      inputSchema: z.object({ pageId: z.string().min(1), properties: z.record(z.string(), z.unknown()) }),
      execute: async ({ pageId, properties }) => updateNotionPage(userId, pageId, properties),
    }),
    notion_append_blocks: tool({
      description: "Append blocks (Notion block array) to a page or block.",
      inputSchema: z.object({ blockId: z.string().min(1), children: z.array(z.unknown()) }),
      execute: async ({ blockId, children }) => appendNotionBlocks(userId, blockId, children),
    }),
  };
}
