import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const VERCEL_API = "https://api.vercel.com";

async function vercelFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Vercel API ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function teamQuery(teamId?: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

function teamQueryExtra(teamId?: string) {
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
}

export interface VercelProjectSummary {
  id: string;
  name: string;
  framework: string | null;
  updatedAt: number;
  link?: { type: string; repo?: string; org?: string };
}

export interface VercelDeploymentSummary {
  uid: string;
  name: string;
  url: string;
  state: string;
  target: string | null;
  createdAt: number;
  meta?: Record<string, unknown>;
}

export async function validateAndStoreVercelToken(userId: string, token: string) {
  const viewer = await vercelFetch<{ user: { username: string; email: string; id: string } }>(token, "/v2/user");
  await upsertAuthProfile({
    userId,
    provider: "vercel",
    type: "api_key",
    token,
    metadata: {
      username: viewer.user.username,
      email: viewer.user.email,
      vercelUserId: viewer.user.id,
    },
  });
  return { user: viewer.user };
}

export async function getVercelStatus(userId: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) return { connected: false as const };
  const viewer = await vercelFetch<{ user: { username: string; email: string } }>(token, "/v2/user");
  return { connected: true as const, user: viewer.user };
}

export async function listVercelTeams(userId: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  const data = await vercelFetch<{ teams: Array<{ id: string; slug: string; name: string }> }>(token, "/v2/teams");
  return data.teams ?? [];
}

export async function listVercelProjects(userId: string, teamId?: string, limit = 20) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  const data = await vercelFetch<{ projects: Array<VercelProjectSummary & { id: string }> }>(
    token,
    `/v9/projects?limit=${limit}${teamQueryExtra(teamId)}`,
  );
  return data.projects ?? [];
}

export async function getVercelProject(userId: string, projectIdOrName: string, teamId?: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  return vercelFetch<VercelProjectSummary & { env?: unknown[] }>(
    token,
    `/v9/projects/${encodeURIComponent(projectIdOrName)}${teamQuery(teamId)}`,
  );
}

export async function listVercelDeployments(userId: string, opts: { projectId?: string; teamId?: string; limit?: number } = {}) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  const params = new URLSearchParams();
  params.set("limit", String(opts.limit ?? 20));
  if (opts.projectId) params.set("projectId", opts.projectId);
  if (opts.teamId) params.set("teamId", opts.teamId);
  const data = await vercelFetch<{ deployments: VercelDeploymentSummary[] }>(token, `/v6/deployments?${params.toString()}`);
  return data.deployments ?? [];
}

export async function getVercelDeployment(userId: string, deploymentId: string, teamId?: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  return vercelFetch<Record<string, unknown>>(token, `/v13/deployments/${encodeURIComponent(deploymentId)}${teamQuery(teamId)}`);
}

export async function getVercelDeploymentEvents(userId: string, deploymentId: string, teamId?: string, limit = 100) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  return vercelFetch<unknown>(
    token,
    `/v3/deployments/${encodeURIComponent(deploymentId)}/events?limit=${limit}${teamQueryExtra(teamId)}`,
  );
}

export interface VercelEnvVarInput {
  key: string;
  value: string;
  type: "encrypted" | "plain" | "system" | "sensitive";
  target: Array<"production" | "preview" | "development">;
  comment?: string;
}

export async function listVercelEnvVars(userId: string, projectIdOrName: string, teamId?: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  const data = await vercelFetch<{ envs: Array<{ id: string; key: string; target: string[]; type: string; updatedAt: number }> }>(
    token,
    `/v10/projects/${encodeURIComponent(projectIdOrName)}/env${teamQuery(teamId)}`,
  );
  return data.envs ?? [];
}

export async function createVercelEnvVar(userId: string, projectIdOrName: string, env: VercelEnvVarInput, teamId?: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  return vercelFetch<unknown>(
    token,
    `/v10/projects/${encodeURIComponent(projectIdOrName)}/env${teamQuery(teamId)}`,
    { method: "POST", body: JSON.stringify(env) },
  );
}

export async function deleteVercelEnvVar(userId: string, projectIdOrName: string, envId: string, teamId?: string) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  await vercelFetch<unknown>(
    token,
    `/v9/projects/${encodeURIComponent(projectIdOrName)}/env/${encodeURIComponent(envId)}${teamQuery(teamId)}`,
    { method: "DELETE" },
  );
  return { ok: true };
}

export async function listVercelDomains(userId: string, teamId?: string, limit = 50) {
  const token = await resolveProviderKey("vercel", userId);
  if (!token) throw new Error("Vercel token not configured");
  const data = await vercelFetch<{ domains: Array<{ name: string; verified: boolean; createdAt: number }> }>(
    token,
    `/v5/domains?limit=${limit}${teamQueryExtra(teamId)}`,
  );
  return data.domains ?? [];
}
