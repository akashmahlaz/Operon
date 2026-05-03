import { tool } from "ai";
import { z } from "zod";
import { getActiveWorkspaceFiles, saveWorkspaceFile } from "@/lib/services/workspace-files";
import { appendLog } from "@/lib/services/logs";

/**
 * Tool that lets the AI read and write the three workspace files:
 *  - bootstrap  operational rules, always applied first
 *  - soul       personality / voice preferences
 *  - user       learned facts about the operator (the "USER.md" profile)
 *
 * The AI should proactively update "user" as it learns about the operator,
 * building a persistent profile that improves personalization over time.
 */
export function createWorkspaceFileTools(userId: string) {
  return {
    workspace_file_read: tool({
      description:
        "Read a workspace file (bootstrap / soul / user). Use when you need to check the operator's current profile or rules before making changes.",
      inputSchema: z.object({
        kind: z.enum(["bootstrap", "soul", "user"]).describe(
          "'bootstrap' = operational rules, 'soul' = personality/voice, 'user' = operator profile",
        ),
      }),
      execute: async ({ kind }) => {
        const files = await getActiveWorkspaceFiles(userId);
        return { kind, content: files[kind] ?? "" };
      },
    }),

    workspace_file_write: tool({
      description:
        "Update a workspace file. Use 'user' to record new facts about the operator — this builds their permanent profile and improves every future conversation. " +
        "Use mode='append' to add facts without replacing existing content. " +
        "Use mode='replace' only when content is being restructured.",
      inputSchema: z.object({
        kind: z.enum(["bootstrap", "soul", "user"]).describe(
          "'bootstrap' = operational rules, 'soul' = personality/voice, 'user' = operator profile",
        ),
        content: z.string().min(1).max(8000).describe("Content to write or append"),
        mode: z
          .enum(["replace", "append"])
          .optional()
          .describe("'append' adds to existing content (default). 'replace' overwrites completely."),
      }),
      execute: async ({ kind, content, mode = "append" }) => {
        let final = content;
        if (mode === "append") {
          const existing = await getActiveWorkspaceFiles(userId);
          const prev = (existing[kind] ?? "").trim();
          final = prev ? `${prev}\n${content.trim()}` : content.trim();
        }
        await saveWorkspaceFile(userId, kind, final);
        await appendLog({
          userId,
          level: "info",
          source: "ai-tool",
          message: `workspace_file_write: ${kind} (${mode})`,
          metadata: { kind, mode, length: final.length },
        });
        return { ok: true, kind, mode, length: final.length };
      },
    }),
  };
}
