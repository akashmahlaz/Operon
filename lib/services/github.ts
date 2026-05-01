import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const GITHUB_API = "https://api.github.com";

export interface GitHubRepoSummary {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  pushedAt: string | null;
  url: string;
}

async function githubFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`GitHub API ${response.status}: ${text || response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function normalizeRepo(repo: {
  id: number;
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string | null;
  html_url: string;
}): GitHubRepoSummary {
  return {
    id: repo.id,
    fullName: repo.full_name,
    description: repo.description,
    private: repo.private,
    language: repo.language,
    defaultBranch: repo.default_branch,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    url: repo.html_url,
  };
}

export async function validateAndStoreGitHubToken(userId: string, token: string) {
  const viewer = await githubFetch<{ login: string; name: string | null; avatar_url: string; html_url: string }>(token, "/user");
  const repos = await listReposWithToken(token, 12);
  await upsertAuthProfile({
    userId,
    provider: "github",
    type: "api_key",
    token,
    metadata: {
      login: viewer.login,
      name: viewer.name,
      avatarUrl: viewer.avatar_url,
      url: viewer.html_url,
      repoCountPreview: repos.length,
    },
  });
  return { viewer, repos };
}

export async function getGitHubStatus(userId: string) {
  const token = await resolveProviderKey("github", userId);
  if (!token) return { connected: false as const };
  const viewer = await githubFetch<{ login: string; name: string | null; avatar_url: string; html_url: string }>(token, "/user");
  return { connected: true as const, viewer };
}

async function listReposWithToken(token: string, perPage = 30) {
  const repos = await githubFetch<Array<Parameters<typeof normalizeRepo>[0]>>(
    token,
    `/user/repos?sort=pushed&per_page=${perPage}&affiliation=owner,collaborator,organization_member`,
  );
  return repos.map(normalizeRepo);
}

export async function listGitHubRepos(userId: string, perPage = 30) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  return listReposWithToken(token, perPage);
}

export async function listGitHubRepoContents(userId: string, owner: string, repo: string, path = "", ref?: string) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return githubFetch<unknown>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}${query}`);
}
