import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  deleteAgentSkill,
  listAgentSkills,
  recordAgentSkillRun,
  saveAgentSkill,
  searchAgentSkills,
} from "@/lib/services/agent-skills";

/**
 * Procedural-memory tools (Hermes-style).
 *
 * The agent uses these to:
 *  - recall a saved recipe ("how do I deploy a Next.js app to Vercel?"),
 *  - save a new recipe after a successful multi-step run,
 *  - record outcomes so confident skills get promoted in future recalls.
 */
export function createAgentSkillTools(userId: string) {
  return {
    skill_recall: tool({
      description:
        "Search the user's saved skills (procedural recipes) by a natural-language hint. Use this BEFORE attempting a multi-step workflow — if a matching skill exists, follow its steps instead of replanning from scratch.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Plain-language description of what the user wants to do."),
        limit: z.number().int().min(1).max(20).optional(),
      }),
      execute: async ({ query, limit }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Skill recall", metadata: { tool: "skill_recall", query } });
        return { skills: await searchAgentSkills(userId, query, limit ?? 5) };
      },
    }),
    skill_list: tool({
      description: "List all saved skills for the current user, most-recently-updated first.",
      inputSchema: z.object({}),
      execute: async () => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Skill list", metadata: { tool: "skill_list" } });
        return { skills: await listAgentSkills(userId) };
      },
    }),
    skill_save: tool({
      description:
        "Save a successful multi-step workflow as a re-runnable skill. Call this AFTER completing a workflow the user might repeat (e.g. 'scaffold a Next.js + Supabase app and deploy to Vercel'). Steps should reference real tool names with the exact arguments used.",
      inputSchema: z.object({
        name: z.string().min(2).max(80).describe("Short kebab- or snake-cased name, e.g. 'deploy-next-supabase-vercel'."),
        description: z.string().min(5).max(500).describe("Human-readable summary of what this skill does."),
        trigger: z
          .string()
          .max(200)
          .optional()
          .describe("Optional natural-language hint used during recall (defaults to description)."),
        tags: z.array(z.string().min(1).max(40)).max(10).optional(),
        steps: z
          .array(
            z.object({
              tool: z.string().min(1).describe("Tool name to invoke."),
              args: z.record(z.string(), z.unknown()).describe("JSON args to pass to the tool."),
              note: z.string().optional(),
            }),
          )
          .min(1)
          .max(40),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Skill saved", metadata: { tool: "skill_save", name: input.name, stepCount: input.steps.length } });
        return { skill: await saveAgentSkill(userId, input) };
      },
    }),
    skill_record_run: tool({
      description: "Record the outcome of a previously-saved skill invocation. Use immediately after running a skill to keep its success/failure stats accurate.",
      inputSchema: z.object({
        name: z.string().min(1),
        outcome: z.enum(["success", "failure"]),
      }),
      execute: async ({ name, outcome }) => {
        await recordAgentSkillRun(userId, name, outcome);
        return { ok: true };
      },
    }),
    skill_delete: tool({
      description: "Delete a saved skill by name. Use when the user asks to remove a recipe or when a skill has consistently failed.",
      inputSchema: z.object({ name: z.string().min(1) }),
      execute: async ({ name }) => {
        const deleted = await deleteAgentSkill(userId, name);
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Skill deleted", metadata: { tool: "skill_delete", name, deleted } });
        return { ok: deleted, name };
      },
    }),
  };
}
