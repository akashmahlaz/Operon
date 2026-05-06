import { mkdir, readdir, readFile as fsReadFile, stat, writeFile as fsWriteFile, unlink, rm } from "node:fs/promises";
import { join, normalize, resolve, sep, dirname, relative } from "node:path";
import { spawn } from "node:child_process";

const WORKSPACE_ROOT = resolve(process.cwd(), "workspaces");

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  ".turbo",
  "target",
  ".venv",
  "__pycache__",
]);

export interface WorkspaceFileEntry {
  path: string;
  type: "file" | "dir";
  size?: number;
  modifiedAt?: string;
}

export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/** Resolve a workspace root for a given conversation. Creates the dir if missing. */
export async function ensureWorkspace(conversationId: string): Promise<string> {
  if (!/^[\w.-]+$/.test(conversationId)) {
    throw new WorkspaceError("invalid conversation id");
  }
  const dir = join(WORKSPACE_ROOT, conversationId);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Resolve a relative path inside a workspace, refusing to escape it. */
export function resolveSafePath(workspaceDir: string, relativePath: string): string {
  const normalized = normalize(relativePath || ".").replace(/^[\\/]+/, "");
  if (normalized.startsWith("..")) throw new WorkspaceError("path escapes workspace");
  const absolute = resolve(workspaceDir, normalized);
  if (absolute !== workspaceDir && !absolute.startsWith(workspaceDir + sep)) {
    throw new WorkspaceError("path escapes workspace");
  }
  return absolute;
}

export async function listWorkspaceDir(
  workspaceDir: string,
  relativePath: string = ".",
): Promise<WorkspaceFileEntry[]> {
  const absolute = resolveSafePath(workspaceDir, relativePath);
  const entries = await readdir(absolute, { withFileTypes: true });
  const out: WorkspaceFileEntry[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) {
      out.push({ path: join(relativePath, entry.name).replaceAll("\\", "/"), type: "dir" });
      continue;
    }
    const full = join(absolute, entry.name);
    let size: number | undefined;
    let modifiedAt: string | undefined;
    if (entry.isFile()) {
      const s = await stat(full).catch(() => null);
      size = s?.size;
      modifiedAt = s ? s.mtime.toISOString() : undefined;
    }
    out.push({
      path: join(relativePath, entry.name).replaceAll("\\", "/"),
      type: entry.isDirectory() ? "dir" : "file",
      size,
      modifiedAt,
    });
  }
  out.sort((a, b) => (a.type === b.type ? a.path.localeCompare(b.path) : a.type === "dir" ? -1 : 1));
  return out;
}

export async function readWorkspaceFile(
  workspaceDir: string,
  relativePath: string,
  maxBytes = 256_000,
): Promise<{ path: string; content: string; truncated: boolean; size: number }> {
  const absolute = resolveSafePath(workspaceDir, relativePath);
  const s = await stat(absolute);
  if (!s.isFile()) throw new WorkspaceError("not a file");
  const buffer = await fsReadFile(absolute);
  const truncated = buffer.length > maxBytes;
  const content = (truncated ? buffer.subarray(0, maxBytes) : buffer).toString("utf8");
  return { path: relativePath, content, truncated, size: buffer.length };
}

export async function writeWorkspaceFile(
  workspaceDir: string,
  relativePath: string,
  content: string,
): Promise<{ path: string; bytes: number }> {
  const absolute = resolveSafePath(workspaceDir, relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await fsWriteFile(absolute, content, "utf8");
  return { path: relativePath, bytes: Buffer.byteLength(content, "utf8") };
}

export async function deleteWorkspacePath(workspaceDir: string, relativePath: string): Promise<void> {
  const absolute = resolveSafePath(workspaceDir, relativePath);
  if (absolute === workspaceDir) throw new WorkspaceError("cannot delete workspace root");
  const s = await stat(absolute).catch(() => null);
  if (!s) return;
  if (s.isDirectory()) await rm(absolute, { recursive: true, force: true });
  else await unlink(absolute);
}

export interface ExecResult {
  command: string;
  cwd: string;
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
}

export async function execInWorkspace(
  workspaceDir: string,
  command: string,
  options: { cwd?: string; timeoutMs?: number; maxOutputBytes?: number } = {},
): Promise<ExecResult> {
  const cwdRel = options.cwd ?? ".";
  const cwdAbs = resolveSafePath(workspaceDir, cwdRel);
  const cwdStat = await stat(cwdAbs).catch(() => null);
  if (!cwdStat?.isDirectory()) throw new WorkspaceError("cwd is not a directory");

  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 5 * 60_000, 1_000), 30 * 60_000);
  const maxBytes = Math.max(options.maxOutputBytes ?? 64_000, 4_000);
  const startedAt = Date.now();

  const isWindows = process.platform === "win32";
  const shell = isWindows ? "cmd.exe" : "/bin/sh";
  const shellArgs = isWindows ? ["/d", "/s", "/c", command] : ["-lc", command];

  return await new Promise<ExecResult>((resolvePromise) => {
    const child = spawn(shell, shellArgs, {
      cwd: cwdAbs,
      env: { ...process.env, OPERON_WORKSPACE: workspaceDir },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;

    const append = (which: "out" | "err", chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (which === "out") {
        if (stdout.length + text.length > maxBytes) {
          stdout += text.slice(0, Math.max(0, maxBytes - stdout.length));
          truncated = true;
        } else stdout += text;
      } else {
        if (stderr.length + text.length > maxBytes) {
          stderr += text.slice(0, Math.max(0, maxBytes - stderr.length));
          truncated = true;
        } else stderr += text;
      }
    };

    child.stdout.on("data", (b: Buffer) => append("out", b));
    child.stderr.on("data", (b: Buffer) => append("err", b));

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!settled) {
            try { child.kill("SIGKILL"); } catch { /* noop */ }
          }
        }, 2_000);
      } catch { /* noop */ }
    }, timeoutMs);

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise({
        command,
        cwd: cwdRel,
        exitCode,
        signal: signal ?? null,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
        truncated,
        timedOut,
      });
    };

    child.on("error", (err) => {
      stderr += `\n[spawn error] ${err.message}`;
      finish(-1, null);
    });
    child.on("close", (code, signal) => finish(code, signal));
  });
}

export async function searchWorkspace(
  workspaceDir: string,
  pattern: string,
  options: { glob?: string; maxMatches?: number; caseInsensitive?: boolean } = {},
): Promise<{ matches: { file: string; line: number; text: string }[]; truncated: boolean }> {
  const fg = (await import("fast-glob")).default;
  const ignore = Array.from(IGNORED_DIRS).map((d) => `**/${d}/**`);
  const files = await fg(options.glob ?? "**/*", {
    cwd: workspaceDir,
    dot: true,
    ignore,
    onlyFiles: true,
    suppressErrors: true,
  });

  const flags = options.caseInsensitive ? "gi" : "g";
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    throw new WorkspaceError(`invalid pattern: ${(e as Error).message}`);
  }

  const max = Math.min(options.maxMatches ?? 200, 1000);
  const matches: { file: string; line: number; text: string }[] = [];

  for (const relPath of files) {
    if (matches.length >= max) break;
    const absolute = join(workspaceDir, relPath);
    const s = await stat(absolute).catch(() => null);
    if (!s || s.size > 2_000_000) continue;
    let text: string;
    try {
      text = await fsReadFile(absolute, "utf8");
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      regex.lastIndex = 0;
      if (regex.test(lines[i])) {
        matches.push({
          file: relPath.replaceAll("\\", "/"),
          line: i + 1,
          text: lines[i].slice(0, 500),
        });
        if (matches.length >= max) break;
      }
    }
  }

  return { matches, truncated: matches.length >= max };
}

export async function applyUnifiedPatch(
  workspaceDir: string,
  unifiedDiff: string,
): Promise<{ files: { path: string; status: "modified" | "created" | "deleted"; lines: number }[] }> {
  const diffMod = await import("diff");
  const patches = diffMod.parsePatch(unifiedDiff);
  if (patches.length === 0) throw new WorkspaceError("no patches found in diff");

  const result: { path: string; status: "modified" | "created" | "deleted"; lines: number }[] = [];

  for (const patch of patches) {
    const targetPath = patch.newFileName?.replace(/^[ab]\//, "") ?? patch.oldFileName?.replace(/^[ab]\//, "");
    if (!targetPath || targetPath === "/dev/null") {
      // deletion
      const oldPath = patch.oldFileName?.replace(/^[ab]\//, "");
      if (oldPath) {
        const absolute = resolveSafePath(workspaceDir, oldPath);
        await unlink(absolute).catch(() => undefined);
        result.push({ path: oldPath, status: "deleted", lines: 0 });
      }
      continue;
    }

    const absolute = resolveSafePath(workspaceDir, targetPath);
    const isCreation = patch.oldFileName === "/dev/null" || patch.oldFileName?.endsWith("/dev/null");
    let original = "";
    if (!isCreation) {
      original = await fsReadFile(absolute, "utf8").catch(() => "");
    }
    const patched = diffMod.applyPatch(original, patch);
    if (patched === false) {
      throw new WorkspaceError(`patch failed to apply cleanly to ${targetPath}`);
    }
    await mkdir(dirname(absolute), { recursive: true });
    await fsWriteFile(absolute, patched, "utf8");
    result.push({
      path: targetPath,
      status: isCreation ? "created" : "modified",
      lines: patched.split("\n").length,
    });
  }

  return { files: result };
}

export function workspaceRelativePath(workspaceDir: string, absolutePath: string): string {
  return relative(workspaceDir, absolutePath).replaceAll("\\", "/");
}

export { WORKSPACE_ROOT };
