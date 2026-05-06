import { tool } from "ai";
import { z } from "zod";
import {
  applyUnifiedPatch,
  deleteWorkspacePath,
  ensureWorkspace,
  execInWorkspace,
  listWorkspaceDir,
  readWorkspaceFile,
  searchWorkspace,
  WorkspaceError,
  writeWorkspaceFile,
} from "@/lib/services/coding-workspace";
import { collections } from "@/lib/db-collections";
import type { Document } from "mongodb";
import { appendLog } from "@/lib/services/logs";

interface CodingPlanItem {
  id: number;
  text: string;
  status: "pending" | "in_progress" | "done" | "blocked";
  notes?: string;
}

interface StoredCodingPlan extends Document {
  _id: string; // conversationId
  userId: string;
  items: CodingPlanItem[];
  updatedAt: string;
}

const codingPlans = () => collections.collection<StoredCodingPlan>("coding_plans");

function badResult(error: unknown) {
  const message = error instanceof WorkspaceError || error instanceof Error
    ? error.message
    : String(error);
  return { ok: false as const, error: message };
}

function logToolUse(userId: string, conversationId: string, name: string, metadata: Record<string, unknown>) {
  void appendLog({
    userId,
    level: "info",
    source: "coding-tool",
    message: name,
    metadata: { conversationId, ...metadata },
  }).catch(() => undefined);
}

/**
 * Coding tools — operate against ./workspaces/<conversationId>/.
 * The conversationId is captured from the URL/body in /api/chat and passed
 * here at build time so each tool call resolves the correct workspace.
 */
export function createCodingTools(userId: string, conversationId: string | null) {
  const requireConversation = () => {
    if (!conversationId) {
      throw new WorkspaceError(
        "no active conversation — refuse the request and tell the user to start a new chat",
      );
    }
    return conversationId;
  };

  return {
    coding_list_dir: tool({
      description:
        "List files and subdirectories in the workspace (relative path, default '.'). Returns entries sorted directories-first.",
      inputSchema: z.object({
        path: z.string().optional().describe("Relative path inside the workspace, defaults to '.'."),
      }),
      execute: async ({ path }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const entries = await listWorkspaceDir(ws, path ?? ".");
          logToolUse(userId, cid, "coding_list_dir", { path: path ?? ".", count: entries.length });
          return { ok: true, path: path ?? ".", entries };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_read_file: tool({
      description:
        "Read a file from the workspace. Returns content as text (UTF-8). Truncates files larger than 256KB.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Relative path to the file inside the workspace."),
      }),
      execute: async ({ path }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const result = await readWorkspaceFile(ws, path);
          logToolUse(userId, cid, "coding_read_file", { path, size: result.size, truncated: result.truncated });
          return { ok: true, ...result };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_write_file: tool({
      description:
        "Create or overwrite a file in the workspace. Creates parent directories automatically. Use this for full-file writes; for surgical edits prefer coding_apply_patch.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Relative path inside the workspace."),
        content: z.string().describe("Full file content. Will overwrite any existing file at this path."),
      }),
      execute: async ({ path, content }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const result = await writeWorkspaceFile(ws, path, content);
          logToolUse(userId, cid, "coding_write_file", { path, bytes: result.bytes });
          return { ok: true, ...result };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_delete_path: tool({
      description: "Delete a file or directory inside the workspace.",
      inputSchema: z.object({
        path: z.string().min(1).describe("Relative path inside the workspace."),
      }),
      execute: async ({ path }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          await deleteWorkspacePath(ws, path);
          logToolUse(userId, cid, "coding_delete_path", { path });
          return { ok: true, path };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_apply_patch: tool({
      description:
        "Apply a unified-diff patch to one or more files in the workspace. Use standard `--- a/path` / `+++ b/path` headers. " +
        "Use `/dev/null` as the old path to create a file or as the new path to delete one. " +
        "Patches must apply cleanly — call coding_read_file first to confirm exact context lines.",
      inputSchema: z.object({
        diff: z.string().min(10).describe("Unified diff covering one or more files."),
      }),
      execute: async ({ diff }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const result = await applyUnifiedPatch(ws, diff);
          logToolUse(userId, cid, "coding_apply_patch", { files: result.files.length });
          return { ok: true, ...result };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_exec: tool({
      description:
        "Run a shell command inside the workspace. Captures stdout/stderr (each capped at 64 KB) and exit code. " +
        "Default timeout 5 minutes, max 30 minutes. On Windows runs via cmd.exe; on Unix via /bin/sh -lc. " +
        "Use this for installs, builds, tests, scaffolding generators (e.g. `pnpm create next-app`), git, etc.",
      inputSchema: z.object({
        command: z.string().min(1).describe("Shell command to execute."),
        cwd: z
          .string()
          .optional()
          .describe("Working directory relative to workspace root. Defaults to '.'"),
        timeoutMs: z
          .number()
          .int()
          .min(1_000)
          .max(30 * 60_000)
          .optional()
          .describe("Timeout in milliseconds (default 300000 = 5 minutes, max 1800000 = 30 minutes)."),
      }),
      execute: async ({ command, cwd, timeoutMs }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const result = await execInWorkspace(ws, command, { cwd, timeoutMs });
          logToolUse(userId, cid, "coding_exec", {
            command: command.slice(0, 200),
            cwd: cwd ?? ".",
            exitCode: result.exitCode,
            durationMs: result.durationMs,
            timedOut: result.timedOut,
          });
          return { ok: true, ...result };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_search: tool({
      description:
        "Search the workspace for a regular-expression pattern. Returns up to 200 matches with file path and line number.",
      inputSchema: z.object({
        pattern: z.string().min(1).describe("Regular expression."),
        glob: z
          .string()
          .optional()
          .describe("Optional fast-glob pattern to scope the search (e.g. 'src/**/*.ts'). Default '**/*'."),
        caseInsensitive: z.boolean().optional().describe("Case-insensitive match. Default false."),
      }),
      execute: async ({ pattern, glob, caseInsensitive }) => {
        try {
          const cid = requireConversation();
          const ws = await ensureWorkspace(cid);
          const result = await searchWorkspace(ws, pattern, { glob, caseInsensitive });
          logToolUse(userId, cid, "coding_search", {
            pattern,
            glob: glob ?? "**/*",
            matches: result.matches.length,
          });
          return { ok: true, pattern, ...result };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_plan_set: tool({
      description:
        "Create or replace the coding plan for this session. Each item is a short imperative step. The plan is shown to the operator and persists across turns.",
      inputSchema: z.object({
        items: z
          .array(z.string().min(1).max(200))
          .min(1)
          .max(40)
          .describe("Ordered list of plan steps as short sentences."),
      }),
      execute: async ({ items }) => {
        try {
          const cid = requireConversation();
          const plan: CodingPlanItem[] = items.map((text, idx) => ({
            id: idx + 1,
            text,
            status: idx === 0 ? "in_progress" : "pending",
          }));
          await codingPlans().updateOne(
            { _id: cid },
            { $set: { _id: cid, userId, items: plan, updatedAt: new Date().toISOString() } },
            { upsert: true },
          );
          logToolUse(userId, cid, "coding_plan_set", { count: plan.length });
          return { ok: true, items: plan };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_plan_update: tool({
      description:
        "Update one plan item's status (pending, in_progress, done, blocked). Optionally add a short note.",
      inputSchema: z.object({
        id: z.number().int().min(1).describe("Item id (1-based)."),
        status: z.enum(["pending", "in_progress", "done", "blocked"]),
        notes: z.string().max(400).optional(),
      }),
      execute: async ({ id, status, notes }) => {
        try {
          const cid = requireConversation();
          const plan = await codingPlans().findOne({ _id: cid });
          if (!plan) return { ok: false, error: "no plan set yet — call coding_plan_set first" };
          const items = plan.items.map((item) =>
            item.id === id ? { ...item, status, notes: notes ?? item.notes } : item,
          );
          await codingPlans().updateOne(
            { _id: cid },
            { $set: { items, updatedAt: new Date().toISOString() } },
          );
          logToolUse(userId, cid, "coding_plan_update", { id, status });
          return { ok: true, items };
        } catch (e) {
          return badResult(e);
        }
      },
    }),

    coding_plan_get: tool({
      description: "Read the current coding plan.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const cid = requireConversation();
          const plan = await codingPlans().findOne({ _id: cid });
          return { ok: true, items: plan?.items ?? [] };
        } catch (e) {
          return badResult(e);
        }
      },
    }),
  };
}
