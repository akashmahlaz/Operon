import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  commentOnLinearIssue,
  createLinearIssue,
  getLinearStatus,
  listLinearIssues,
  listLinearProjects,
  listLinearTeams,
  updateLinearIssue,
  validateAndStoreLinearKey,
} from "@/lib/services/linear";

export function createLinearTools(userId: string) {
  return {
    linear_get_status: tool({
      description: "Check whether Linear is connected.",
      inputSchema: z.object({}),
      execute: async () => getLinearStatus(userId),
    }),
    linear_save_key: tool({
      description: "Securely store a Linear personal API key (lin_api_…). Validates by calling viewer{…}.",
      inputSchema: z.object({ apiKey: z.string().min(20) }),
      execute: async ({ apiKey }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Linear key save attempt", metadata: { tool: "linear_save_key" } });
        return validateAndStoreLinearKey(userId, apiKey);
      },
    }),
    linear_list_teams: tool({
      description: "List Linear teams the operator belongs to.",
      inputSchema: z.object({}),
      execute: async () => listLinearTeams(userId),
    }),
    linear_list_issues: tool({
      description: "List Linear issues, optionally filtered by team and state name (e.g. 'Todo', 'In Progress').",
      inputSchema: z.object({
        teamId: z.string().optional(),
        stateName: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async (input) => listLinearIssues(userId, input),
    }),
    linear_create_issue: tool({
      description: "Create a Linear issue. priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low.",
      inputSchema: z.object({
        teamId: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().int().min(0).max(4).optional(),
        assigneeId: z.string().optional(),
        projectId: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Linear issue created", metadata: { tool: "linear_create_issue", teamId: input.teamId } });
        return createLinearIssue(userId, input);
      },
    }),
    linear_update_issue: tool({
      description: "Update a Linear issue's fields (title, description, stateId, assigneeId, priority, …).",
      inputSchema: z.object({
        issueId: z.string().min(1),
        patch: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ issueId, patch }) => updateLinearIssue(userId, issueId, patch),
    }),
    linear_comment: tool({
      description: "Comment on a Linear issue.",
      inputSchema: z.object({ issueId: z.string().min(1), body: z.string().min(1) }),
      execute: async ({ issueId, body }) => commentOnLinearIssue(userId, issueId, body),
    }),
    linear_list_projects: tool({
      description: "List Linear projects.",
      inputSchema: z.object({}),
      execute: async () => listLinearProjects(userId),
    }),
  };
}
