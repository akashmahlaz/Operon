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

function encodeRepoContentPath(pathname: string) {
  return pathname
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

function repoFullName(owner: string, repo: string) {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
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
  const encodedPath = encodeRepoContentPath(path);
  const suffix = encodedPath ? `/${encodedPath}` : "";
  return githubFetch<unknown>(token, `/repos/${repoFullName(owner, repo)}/contents${suffix}${query}`);
}

export async function getGitHubRepo(userId: string, owner: string, repo: string) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  const data = await githubFetch<Parameters<typeof normalizeRepo>[0] & { stargazers_count: number; forks_count: number; open_issues_count: number }>(
    token,
    `/repos/${repoFullName(owner, repo)}`,
  );
  return {
    ...normalizeRepo(data),
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
  };
}

export async function readGitHubFile(userId: string, owner: string, repo: string, path: string, ref?: string) {
  const content = await listGitHubRepoContents(userId, owner, repo, path, ref);
  if (Array.isArray(content)) throw new Error("Path is a directory, not a file");
  const file = content as { name?: string; path?: string; sha?: string; encoding?: string; content?: string; size?: number; html_url?: string };
  if (file.encoding !== "base64" || typeof file.content !== "string") {
    throw new Error("GitHub file content is not available as base64");
  }
  const text = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  const limit = 80_000;
  return {
    name: file.name,
    path: file.path || path,
    sha: file.sha,
    size: file.size,
    url: file.html_url,
    truncated: text.length > limit,
    content: text.length > limit ? `${text.slice(0, limit)}\n\n... truncated (${text.length} chars total)` : text,
  };
}

export async function searchGitHubCode(userId: string, owner: string, repo: string, query: string, perPage = 10) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  const scopedQuery = `${query} repo:${owner}/${repo}`;
  const data = await githubFetch<{ total_count: number; items: Array<{ name: string; path: string; sha: string; html_url: string; repository: { full_name: string } }> }>(
    token,
    `/search/code?q=${encodeURIComponent(scopedQuery)}&per_page=${Math.min(25, Math.max(1, perPage))}`,
  );
  return {
    totalCount: data.total_count,
    items: data.items.map((item) => ({
      name: item.name,
      path: item.path,
      sha: item.sha,
      url: item.html_url,
      repo: item.repository.full_name,
    })),
  };
}

export interface CreateGitHubRepoInput {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  homepage?: string;
}

export async function createGitHubRepo(userId: string, input: CreateGitHubRepoInput) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  const data = await githubFetch<Parameters<typeof normalizeRepo>[0]>(token, "/user/repos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      private: input.private ?? false,
      auto_init: input.autoInit ?? true,
      gitignore_template: input.gitignoreTemplate,
      license_template: input.licenseTemplate,
      homepage: input.homepage,
    }),
  });
  return normalizeRepo(data);
}

export async function createOrUpdateGitHubFile(
  userId: string,
  args: { owner: string; repo: string; path: string; content: string; message: string; branch?: string; sha?: string },
) {
  const token = await resolveProviderKey("github", userId);
  if (!token) throw new Error("GitHub token not configured");
  const encodedPath = encodeRepoContentPath(args.path);
  const body: Record<string, unknown> = {
    message: args.message,
    content: Buffer.from(args.content, "utf8").toString("base64"),
  };
  if (args.branch) body.branch = args.branch;
  if (args.sha) body.sha = args.sha;
  const data = await githubFetch<{ content: { html_url: string; sha: string; path: string }; commit: { sha: string; html_url: string } }>(
    token,
    `/repos/${repoFullName(args.owner, args.repo)}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return {
    file: { path: data.content.path, sha: data.content.sha, url: data.content.html_url },
    commit: { sha: data.commit.sha, url: data.commit.html_url },
  };
}

