import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  commitMultipleGitHubFiles,
  createGitHubBranch,
  createGitHubPullRequest,
  createGitHubRepo,
  createOrUpdateGitHubFile,
  deleteGitHubFile,
  getGitHubRepo,
  getGitHubStatus,
  listGitHubBranches,
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
    github_list_branches: tool({
      description: "List branches of a GitHub repository (sorted by GitHub default ordering).",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        perPage: z.number().int().min(1).max(100).optional(),
      }),
      execute: async ({ owner, repo, perPage }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub branches listed", metadata: { tool: "github_list_branches", owner, repo } });
        return { branches: await listGitHubBranches(userId, owner, repo, perPage ?? 50) };
      },
    }),
    github_create_branch: tool({
      description: "Create a new branch in a GitHub repository, branched off `fromBranch` (defaults to the repository default branch). Use this before making changes you want to ship as a pull request.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1).describe("New branch name, e.g. 'feat/add-stripe-checkout'."),
        fromBranch: z.string().optional().describe("Source branch. Defaults to the repository default branch."),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub branch created", metadata: { tool: "github_create_branch", owner: input.owner, repo: input.repo, branch: input.branch } });
        return createGitHubBranch(userId, input);
      },
    }),
    github_delete_file: tool({
      description: "Delete a single file from a GitHub repository. Requires the file's current `sha` (read it first with github_read_file).",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        path: z.string().min(1),
        message: z.string().min(1),
        sha: z.string().min(1),
        branch: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub file deleted", metadata: { tool: "github_delete_file", owner: input.owner, repo: input.repo, path: input.path } });
        return deleteGitHubFile(userId, input);
      },
    }),
    github_commit_files: tool({
      description: "Commit multiple file changes (writes and/or deletes) in a single commit on a branch. Prefer this over multiple github_write_file calls when scaffolding or refactoring — it produces ONE clean commit and is much faster.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        branch: z.string().min(1).describe("Target branch (must already exist; create with github_create_branch if needed)."),
        message: z.string().min(1).describe("Commit message describing the change."),
        files: z
          .array(
            z.union([
              z.object({
                path: z.string().min(1),
                content: z.string().describe("Full plain-text file content."),
              }),
              z.object({
                path: z.string().min(1),
                delete: z.literal(true).describe("Set to true to delete this path."),
              }),
            ]),
          )
          .min(1)
          .max(80)
          .describe("List of file writes and/or deletes to apply atomically."),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub multi-file commit", metadata: { tool: "github_commit_files", owner: input.owner, repo: input.repo, branch: input.branch, fileCount: input.files.length } });
        return commitMultipleGitHubFiles(userId, input);
      },
    }),
    github_create_pr: tool({
      description: "Open a pull request from `head` branch into `base` branch. Use after pushing a feature branch with github_commit_files. The returned `url` is the PR page on github.com.",
      inputSchema: z.object({
        owner: z.string().min(1),
        repo: z.string().min(1),
        title: z.string().min(1),
        head: z.string().min(1).describe("Source branch (the branch with the new commits)."),
        base: z.string().min(1).describe("Target branch (usually 'main' or the repo default branch)."),
        body: z.string().optional().describe("Markdown PR body explaining the change."),
        draft: z.boolean().optional().describe("Open as draft PR. Defaults to false."),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "GitHub PR opened", metadata: { tool: "github_create_pr", owner: input.owner, repo: input.repo, head: input.head, base: input.base } });
        return createGitHubPullRequest(userId, input);
      },
    }),
  };
}