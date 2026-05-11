import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  createVercelEnvVar,
  deleteVercelEnvVar,
  getVercelDeployment,
  getVercelDeploymentEvents,
  getVercelProject,
  getVercelStatus,
  listVercelDeployments,
  listVercelDomains,
  listVercelEnvVars,
  listVercelProjects,
  listVercelTeams,
  validateAndStoreVercelToken,
} from "@/lib/services/vercel";

export function createVercelTools(userId: string) {
  return {
    vercel_get_status: tool({
      description: "Check whether the user has connected Vercel and return the authenticated account.",
      inputSchema: z.object({}),
      execute: async () => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Vercel status", metadata: { tool: "vercel_get_status" } });
        return getVercelStatus(userId);
      },
    }),
    vercel_save_token: tool({
      description: "Securely store a Vercel access token. Validates by fetching the authenticated user, then encrypts and saves. Tokens can be created at vercel.com/account/tokens.",
      inputSchema: z.object({ token: z.string().min(20) }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Vercel token save attempt", metadata: { tool: "vercel_save_token" } });
        const result = await validateAndStoreVercelToken(userId, token);
        return { saved: true, username: result.user.username, email: result.user.email };
      },
    }),
    vercel_list_teams: tool({
      description: "List Vercel teams the operator belongs to.",
      inputSchema: z.object({}),
      execute: async () => ({ teams: await listVercelTeams(userId) }),
    }),
    vercel_list_projects: tool({
      description: "List Vercel projects, optionally scoped to a team.",
      inputSchema: z.object({
        teamId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ teamId, limit }) => ({ projects: await listVercelProjects(userId, teamId, limit ?? 20) }),
    }),
    vercel_get_project: tool({
      description: "Fetch details for one Vercel project (id or name).",
      inputSchema: z.object({
        project: z.string().min(1),
        teamId: z.string().optional(),
      }),
      execute: async ({ project, teamId }) => getVercelProject(userId, project, teamId),
    }),
    vercel_list_deployments: tool({
      description: "List recent Vercel deployments, optionally scoped by project or team.",
      inputSchema: z.object({
        projectId: z.string().optional(),
        teamId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ projectId, teamId, limit }) => ({
        deployments: await listVercelDeployments(userId, { projectId, teamId, limit }),
      }),
    }),
    vercel_get_deployment: tool({
      description: "Fetch full details (status, build target, source) for one deployment by id.",
      inputSchema: z.object({ deploymentId: z.string().min(1), teamId: z.string().optional() }),
      execute: async ({ deploymentId, teamId }) => getVercelDeployment(userId, deploymentId, teamId),
    }),
    vercel_get_deployment_logs: tool({
      description: "Fetch build/runtime events for a deployment. Use to debug failed builds.",
      inputSchema: z.object({
        deploymentId: z.string().min(1),
        teamId: z.string().optional(),
        limit: z.number().int().min(1).max(1000).optional(),
      }),
      execute: async ({ deploymentId, teamId, limit }) => ({
        events: await getVercelDeploymentEvents(userId, deploymentId, teamId, limit ?? 100),
      }),
    }),
    vercel_list_env_vars: tool({
      description: "List environment variables (without decrypted values) for a project.",
      inputSchema: z.object({ project: z.string().min(1), teamId: z.string().optional() }),
      execute: async ({ project, teamId }) => ({ env: await listVercelEnvVars(userId, project, teamId) }),
    }),
    vercel_create_env_var: tool({
      description: "Create or update an environment variable on a Vercel project. Use type='encrypted' for secrets.",
      inputSchema: z.object({
        project: z.string().min(1),
        teamId: z.string().optional(),
        key: z.string().min(1),
        value: z.string().min(1),
        type: z.enum(["encrypted", "plain", "system", "sensitive"]).optional(),
        target: z.array(z.enum(["production", "preview", "development"])).min(1),
        comment: z.string().optional(),
      }),
      execute: async ({ project, teamId, key, value, type, target, comment }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Vercel env var created", metadata: { tool: "vercel_create_env_var", project, key } });
        return createVercelEnvVar(userId, project, { key, value, type: type ?? "encrypted", target, comment }, teamId);
      },
    }),
    vercel_delete_env_var: tool({
      description: "Delete an environment variable from a Vercel project by env var id.",
      inputSchema: z.object({
        project: z.string().min(1),
        envId: z.string().min(1),
        teamId: z.string().optional(),
      }),
      execute: async ({ project, envId, teamId }) => deleteVercelEnvVar(userId, project, envId, teamId),
    }),
    vercel_list_domains: tool({
      description: "List domains owned by the operator's Vercel account.",
      inputSchema: z.object({
        teamId: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
      execute: async ({ teamId, limit }) => ({ domains: await listVercelDomains(userId, teamId, limit ?? 50) }),
    }),
  };
}
