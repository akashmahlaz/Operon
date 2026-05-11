/**
 * Linear (linear.app) GraphQL service. Stores a personal API key (lin_api_…)
 * under provider="linear" type="api_key".
 */

import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const LINEAR_API = "https://api.linear.app/graphql";

async function gql<T>(userId: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const tk = await resolveProviderKey("linear", userId);
  if (!tk) throw notConnectedError("linear", "Linear");
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: tk },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!res.ok || json.errors?.length) {
    const msg = json.errors?.[0]?.message ?? res.statusText;
    throw new Error(`Linear ${res.status}: ${msg}`);
  }
  return json.data as T;
}

export async function validateAndStoreLinearKey(userId: string, apiKey: string) {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query: "{ viewer { id name email } }" }),
  });
  const json = (await res.json()) as { data?: { viewer?: { id: string; name: string; email: string } }; errors?: Array<{ message: string }> };
  const viewer = json.data?.viewer;
  if (!viewer) throw new Error(`Linear key validation failed: ${json.errors?.[0]?.message ?? "unknown"}`);
  await upsertAuthProfile({
    userId,
    provider: "linear",
    type: "api_key",
    token: apiKey,
    metadata: { userId: viewer.id, name: viewer.name, email: viewer.email },
  });
  return { viewer };
}

export async function getLinearStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("linear", userId);
    if (!tk) return { connected: false };
    const data = await gql<{ viewer: { id: string; name: string; email: string } }>(userId, "{ viewer { id name email } }");
    return { connected: true, viewer: data.viewer };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listLinearTeams(userId: string) {
  return gql<{ teams: { nodes: Array<{ id: string; name: string; key: string }> } }>(
    userId,
    "{ teams { nodes { id name key } } }",
  );
}

export async function listLinearIssues(userId: string, params: { teamId?: string; stateName?: string; limit?: number }) {
  const filter: Record<string, unknown> = {};
  if (params.teamId) filter.team = { id: { eq: params.teamId } };
  if (params.stateName) filter.state = { name: { eq: params.stateName } };
  return gql<{ issues: { nodes: unknown[] } }>(
    userId,
    `query($first: Int, $filter: IssueFilter) { issues(first: $first, filter: $filter) { nodes { id identifier title state { name } assignee { name } priority url } } }`,
    { first: params.limit ?? 25, filter },
  );
}

export async function createLinearIssue(userId: string, params: {
  teamId: string;
  title: string;
  description?: string;
  priority?: number;
  assigneeId?: string;
  projectId?: string;
}) {
  return gql<{ issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } } }>(
    userId,
    `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
    { input: params },
  );
}

export async function updateLinearIssue(userId: string, issueId: string, patch: Record<string, unknown>) {
  return gql<{ issueUpdate: { success: boolean } }>(
    userId,
    `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
    { id: issueId, input: patch },
  );
}

export async function commentOnLinearIssue(userId: string, issueId: string, body: string) {
  return gql<{ commentCreate: { success: boolean; comment: { id: string } } }>(
    userId,
    `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }`,
    { input: { issueId, body } },
  );
}

export async function listLinearProjects(userId: string) {
  return gql<{ projects: { nodes: Array<{ id: string; name: string; state: string; url: string }> } }>(
    userId,
    "{ projects(first: 50) { nodes { id name state url } } }",
  );
}
