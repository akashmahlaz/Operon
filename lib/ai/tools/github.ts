import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  createGitHubRepo,
  createOrUpdateGitHubFile,
  getGitHubRepo,
  getGitHubStatus,
  listGitHubRepoContents,
  listGitHubRepos,
  readGitHubFile,
  searchGitHubCode,
  validateAndStoreGitHubToken,
} from "@/lib/services/github";

export function createGitHubTools(userId: string) {
  return {
    github_get_status: tool({
      description: "Check whether the current user has connected GitHub and return the authenticated account.",
      inputSchema: z.object({}),
      execute: async () => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub status tool called", metadata: { tool: "github_get_status" } });
        return getGitHubStatus(userId);
      },
    }),
    github_list_repos: tool({
      description: "List repositories available to the connected GitHub account, sorted by recent push.",
      inputSchema: z.object({
        perPage: z.number().int().min(1).max(100).optional().describe("Maximum repositories to return."),
      }),
      execute: async ({ perPage }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub repos listed", metadata: { tool: "github_list_repos", perPage } });
        return { repos: await listGitHubRepos(userId, perPage ?? 20) };
      },
    }),
    github_get_repo: tool({
      description: "Read metadata for one GitHub repository.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
      }),
      execute: async ({ owner, repo }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub repo read", metadata: { tool: "github_get_repo", owner, repo } });
        return getGitHubRepo(userId, owner, repo);
      },
    }),
    github_list_contents: tool({
      description: "List files or directories in a GitHub repository path.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().optional().describe("Repository path. Leave empty for the root."),
        ref: z.string().optional().describe("Branch, tag, or commit SHA."),
      }),
      execute: async ({ owner, repo, path, ref }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub contents listed", metadata: { tool: "github_list_contents", owner, repo, path: path || "" } });
        return { contents: await listGitHubRepoContents(userId, owner, repo, path ?? "", ref) };
      },
    }),
    github_read_file: tool({
      description: "Read one text file from a GitHub repository. Use this before explaining or reviewing repository code.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().min(1),
        ref: z.string().optional().describe("Branch, tag, or commit SHA."),
      }),
      execute: async ({ owner, repo, path, ref }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub file read", metadata: { tool: "github_read_file", owner, repo, path } });
        return readGitHubFile(userId, owner, repo, path, ref);
      },
    }),
    github_search_code: tool({
      description: "Search code inside a specific GitHub repository.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        query: z.string().min(1),
        perPage: z.number().int().min(1).max(25).optional(),
      }),
      execute: async ({ owner, repo, query, perPage }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub code searched", metadata: { tool: "github_search_code", owner, repo, query } });
        return searchGitHubCode(userId, owner, repo, query, perPage ?? 10);
      },
    }),
    github_save_token: tool({
      description: "Securely store a GitHub Personal Access Token (PAT) for the operator. Validates the token by fetching the authenticated viewer, then encrypts and saves it. Use this immediately when the operator pastes a token. After saving, never echo the token back — confirm by mentioning the GitHub login it authenticated as.",
      inputSchema: z.object({
        token: z.string().min(20).describe("The GitHub PAT (e.g. starts with `ghp_` or `github_pat_`)."),
      }),
      execute: async ({ token }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub token save attempt", metadata: { tool: "github_save_token" } });
        const result = await validateAndStoreGitHubToken(userId, token);
        return {
          saved: true,
          login: result.viewer.login,
          name: result.viewer.name,
          accountUrl: result.viewer.html_url,
          repoCountPreview: result.repos.length,
        };
      },
    }),
    github_create_repo: tool({
      description: "Create a new GitHub repository under the connected operator account. Initializes with README by default. Supports gitignore template (e.g. 'Rust', 'Node', 'Python') and license template (e.g. 'mit', 'apache-2.0').",
      inputSchema: z.object({
        name: z.string().min(1).describe("Repository name (no slashes)."),
        description: z.string().optional(),
        private: z.boolean().optional().describe("Defaults to false (public)."),
        autoInit: z.boolean().optional().describe("Initialize with a README. Defaults to true."),
        gitignoreTemplate: z.string().optional().describe("e.g. 'Rust', 'Node', 'Python', 'Go'."),
        licenseTemplate: z.string().optional().describe("e.g. 'mit', 'apache-2.0'."),
        homepage: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub repo created", metadata: { tool: "github_create_repo", name: input.name, language: input.gitignoreTemplate } });
        return createGitHubRepo(userId, input);
      },
    }),
    github_write_file: tool({
      description: "Create or update a single file in a GitHub repository. Pass the existing `sha` to update an existing file, omit it to create a new one. Content is plain text and will be base64-encoded automatically.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().min(1).describe("Repository file path, e.g. 'src/main.rs'."),
        content: z.string().describe("Plain text file content."),
        message: z.string().min(1).describe("Commit message."),
        branch: z.string().optional().describe("Target branch. Defaults to the repository default branch."),
        sha: z.string().optional().describe("Required only when updating an existing file."),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub file written", metadata: { tool: "github_write_file", owner: input.owner, repo: input.repo, path: input.path } });
        return createOrUpdateGitHubFile(userId, input);
      },
    }),
  };
}