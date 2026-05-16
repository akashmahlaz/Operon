"use client";

import { useState } from "react";
import {
  AlertCircle,
  ChevronRight,
  Circle,
  FileText,
  FolderOpen,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Globe,
  Image as ImageIcon,
  MessageSquareText,
  Mic,
  PencilLine,
  Search,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart } from "@/components/chat/message/types";

// ---------------------------------------------------------------------------
// Per-tool icon map (Copilot-style: file = FileText, search = Search, etc.)
// ---------------------------------------------------------------------------
const TOOL_ICONS: Record<string, typeof FileText> = {
  read_file: FileText,
  workspace_file_read: FileText,
  list_dir: FolderOpen,
  workspace_list: FolderOpen,
  search: Search,
  grep_search: Search,
  workspace_grep: Search,
  exec: Terminal,
  run_command: Terminal,
  apply_patch: PencilLine,
  write_file: PencilLine,
  workspace_file_write: PencilLine,

  tavily_search: Globe,
  web_search: Globe,
  web_request: Globe,

  memory_search: Sparkles,
  memory_remember: Sparkles,
  memory_forget: Sparkles,

  spawn_subagent: Workflow,
  discover_skills: Workflow,

  generate_image: ImageIcon,
  generate_video: ImageIcon,
  text_to_speech: Mic,

  github_get_status: GitBranch,
  github_list_repos: GitBranch,
  github_get_repo: GitBranch,
  github_list_contents: FolderOpen,
  github_read_file: FileText,
  github_write_file: PencilLine,
  github_search_code: Search,
  github_list_branches: GitBranch,
  github_create_branch: GitBranch,
  github_list_issues: MessageSquareText,
  github_create_issue: MessageSquareText,
  github_list_prs: GitPullRequest,
  github_list_pull_requests: GitPullRequest,
  github_create_pr: GitPullRequest,
  github_merge_pr: GitMerge,
  github_push_files: PencilLine,
  github_save_token: GitBranch,
};

const ACTIVE_TOOL_STATES = ["calling", "input-streaming", "input-available", "executing"] as const;

function isActiveToolState(state: string) {
  return ACTIVE_TOOL_STATES.includes(state as (typeof ACTIVE_TOOL_STATES)[number]);
}

function ActivePulseDot() {
  return (
    <span className="relative flex size-3 items-center justify-center">
      <span className="absolute size-2 rounded-full bg-primary/25 animate-ping" />
      <Circle className="relative size-2 fill-primary text-primary animate-(--animate-pulse-soft)" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Per-tool invocation formatter.
//   read_file({path:"foo.ts", start_line:308, end_line:320})
//     -> "Read foo.ts, lines 308 to 320"
// ---------------------------------------------------------------------------
function basename(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i >= 0 ? p.slice(i + 1) : p;
}
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function quote(s: string, max = 56): string {
  const t = s.length > max ? `${s.slice(0, max)}...` : s;
  return `"${t}"`;
}
function formatRepo(args: Record<string, unknown>): string | undefined {
  const owner = asString(args.owner);
  const repo = asString(args.repo);
  if (owner && repo) return `${owner}/${repo}`;
  return asString(args.repository);
}

export function describeTool(toolName: string, args?: Record<string, unknown>): string {
  const a = args ?? {};
  const path = asString(a.path) ?? asString(a.filePath) ?? asString(a.filename);
  const startL = asNumber(a.start_line) ?? asNumber(a.startLine) ?? asNumber(a.start);
  const endL = asNumber(a.end_line) ?? asNumber(a.endLine) ?? asNumber(a.end);
  const query = asString(a.query) ?? asString(a.search) ?? asString(a.q);
  const cmd = asString(a.command) ?? asString(a.cmd);
  const repo = formatRepo(a);
  const branch = asString(a.branch) ?? asString(a.ref);

  switch (toolName) {
    case "read_file":
    case "workspace_file_read":
      if (path && startL != null && endL != null)
        return `Read ${basename(path)}, lines ${startL} to ${endL}`;
      if (path) return `Read ${basename(path)}`;
      return "Read file";

    case "list_dir":
    case "workspace_list":
      return path ? `Listed ${path}` : "Listed directory";

    case "search":
    case "grep_search":
    case "workspace_grep":
      return query ? `Searched for ${quote(query)}` : "Searched workspace";

    case "exec":
    case "run_command":
      return cmd ? `Ran ${quote(cmd, 64)}` : "Ran command";

    case "apply_patch":
      return path ? `Edited ${basename(path)}` : "Edited files";
    case "write_file":
    case "workspace_file_write":
      return path ? `Wrote ${basename(path)}` : "Wrote file";

    case "tavily_search":
    case "web_search":
      return query ? `Searched the web for ${quote(query)}` : "Searched the web";
    case "web_request":
      return asString(a.url) ? `Fetched ${asString(a.url)}` : "Made web request";

    case "memory_search":
      return query ? `Searched memory for ${quote(query)}` : "Searched memory";
    case "memory_remember":
      return "Saved to memory";
    case "memory_forget":
      return "Removed from memory";

    case "spawn_subagent":
      return `Delegated to ${asString(a.agent) ?? "sub-agent"}`;
    case "discover_skills":
      return "Discovered skills";

    case "generate_image":
      return "Generated image";
    case "generate_video":
      return "Generated video";
    case "text_to_speech":
      return "Generated audio";

    case "github_get_status":
      return "Checked GitHub connection";
    case "github_list_repos":
      return "Listed your repositories";
    case "github_get_repo":
      return repo ? `Read ${repo}` : "Read repository";
    case "github_list_contents":
      return repo
        ? `Listed ${repo}${path ? `/${path}` : ""}`
        : "Listed repository contents";
    case "github_read_file":
      if (repo && path && startL != null && endL != null)
        return `Read ${repo}/${path}, lines ${startL} to ${endL}`;
      if (repo && path) return `Read ${repo}/${path}`;
      return "Read GitHub file";
    case "github_write_file":
      return repo && path ? `Edited ${repo}/${path}` : "Edited GitHub file";
    case "github_search_code":
      return query
        ? `Searched GitHub code for ${quote(query)}`
        : "Searched GitHub code";
    case "github_list_branches":
      return repo ? `Listed branches in ${repo}` : "Listed branches";
    case "github_create_branch":
      return branch && repo
        ? `Created branch ${branch} in ${repo}`
        : "Created branch";
    case "github_list_issues":
      return repo ? `Listed issues in ${repo}` : "Listed issues";
    case "github_create_issue":
      return repo ? `Created issue in ${repo}` : "Created issue";
    case "github_list_prs":
    case "github_list_pull_requests":
      return repo ? `Listed pull requests in ${repo}` : "Listed pull requests";
    case "github_create_pr":
      return repo ? `Opened pull request in ${repo}` : "Opened pull request";
    case "github_merge_pr":
      return repo ? `Merged pull request in ${repo}` : "Merged pull request";
    case "github_push_files":
      return repo ? `Pushed files to ${repo}` : "Pushed files";
    case "github_save_token":
      return "Saved GitHub token";

    default:
      if (path) return `${toolName} ${basename(path)}`;
      if (query) return `${toolName} ${quote(query)}`;
      if (repo) return `${toolName} ${repo}`;
      return toolName;
  }
}

// Back-compat: old export name.
export function getToolLabel(toolName: string, args?: Record<string, unknown>) {
  return describeTool(toolName, args);
}

function isRawToolMessage(message: string | undefined, toolName: string): boolean {
  if (!message) return false;
  return message.includes(toolName) || message.includes(`\`${toolName}\``);
}

function ToolIcon({
  toolName,
  state,
  className,
}: {
  toolName: string;
  state: ToolCallPart["state"];
  className?: string;
}) {
  const error = state === "error" || state === "output-error";

  // VS Code pattern: no spinner for active tools — the label shimmers instead
  // (handled by ToolCallItem). Render the static icon for every state so the
  // row's left position never shifts on state transitions.
  if (error) {
    return <AlertCircle className={cn("size-3.5 text-destructive", className)} />;
  }
  const Icon = TOOL_ICONS[toolName] ?? FileText;
  return <Icon className={cn("size-3.5 text-muted-foreground/70", className)} />;
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function ToolPart({ tool }: { tool: ToolCallPart }) {
  const [open, setOpen] = useState(false);
  const error = tool.state === "error" || tool.state === "output-error";
  const isPending = isActiveToolState(tool.state);

  const fallbackLabel = describeTool(tool.toolName, tool.args);
  const invocationMessage = isRawToolMessage(tool.invocationMessage, tool.toolName)
    ? undefined
    : tool.invocationMessage;
  const pastTenseMessage = isRawToolMessage(tool.pastTenseMessage, tool.toolName)
    ? undefined
    : tool.pastTenseMessage;
  const label = isPending
    ? invocationMessage ?? fallbackLabel
    : pastTenseMessage ?? invocationMessage ?? fallbackLabel;

  // Pull a short mono "target" out of args (path / repo / query / cmd / url)
  const a = tool.args ?? {};
  const target =
    asString(a.path) ??
    asString(a.filePath) ??
    asString(a.filename) ??
    asString(a.url) ??
    formatRepo(a) ??
    asString(a.query) ??
    asString(a.search) ??
    asString(a.q) ??
    asString(a.command) ??
    asString(a.cmd);
  const targetShort = target
    ? target.length > 64
      ? `...${target.slice(-61)}`
      : target
    : undefined;

  const hasDetails =
    (tool.args && Object.keys(tool.args).length > 0) || tool.result != null;

  return (
    <div className="group/tool relative">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}
        className={cn(
          "flex w-full max-w-full items-start gap-2.5 py-1 text-left text-[13px] text-muted-foreground transition-colors",
          hasDetails && "hover:text-foreground/80",
          "disabled:cursor-default",
        )}
      >
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
          <ToolIcon toolName={tool.toolName} state={tool.state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate",
                error && "text-destructive",
                isPending && !error && "shimmer-text animated-ellipsis",
              )}
            >
              {label}
            </span>
            {targetShort && (
              <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground/50">
                {targetShort}
              </span>
            )}
            {hasDetails && (
              <ChevronRight
                className={cn(
                  "ml-auto size-3 shrink-0 text-muted-foreground/40 transition-transform",
                  open && "rotate-90",
                )}
              />
            )}
          </div>
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          open && hasDetails ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-6 mt-1 mb-1 space-y-2 border-l border-border/60 pl-3">
            {tool.args && Object.keys(tool.args).length > 0 && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  Input
                </div>
                <pre className="mt-1 overflow-x-auto rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                  {formatJson(tool.args)}
                </pre>
              </div>
            )}
            {tool.result != null && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  Output
                </div>
                <pre className="mt-1 max-h-72 overflow-auto rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                  {typeof tool.result === "string"
                    ? tool.result
                    : formatJson(tool.result)}
                </pre>
              </div>
            )}
            {error && tool.errorText && (
              <div>
                <div className="text-[10px] font-medium uppercase tracking-wide text-destructive/80">
                  Error
                </div>
                <pre className="mt-1 overflow-x-auto rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-destructive">
                  {tool.errorText}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolPartList({ tools }: { tools: ToolCallPart[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!tools.length) return null;

  const collapsible = tools.length > 4;
  const visible = collapsible && !expanded ? tools.slice(-3) : tools;
  const hidden = tools.length - visible.length;

  return (
    <div className="relative ml-0.5 pl-3">
      {collapsible && !expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mb-0.5 flex items-center gap-1 text-[11.5px] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <ChevronRight className="size-3" />
          <span>Show {hidden} earlier {hidden === 1 ? "step" : "steps"}</span>
        </button>
      )}

      {visible.map((tool, index) => {
        const active = isActiveToolState(tool.state);
        const error = tool.state === "error" || tool.state === "output-error";
        const only = visible.length === 1;
        const first = index === 0;
        const last = index === visible.length - 1;
        return (
          <div key={`${tool.toolName}-${index}`} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute -left-3 top-0 bottom-0 w-px bg-muted-foreground/55 dark:bg-border/85",
                only && !active && "hidden",
                only && active && "mask-[linear-gradient(to_bottom,black_0_5px,transparent_5px_20px,black_20px_100%)]",
                !only && first && "mask-[linear-gradient(to_bottom,transparent_0_20px,black_20px_100%)]",
                !only && last && "mask-[linear-gradient(to_bottom,black_0_5px,transparent_5px_100%)]",
                !only && !first && !last && "mask-[linear-gradient(to_bottom,black_0_5px,transparent_5px_20px,black_20px_100%)]",
              )}
            />
            <span className="absolute -left-4 top-3 flex size-2 items-center justify-center bg-background">
              {active && !error ? (
                <ActivePulseDot />
              ) : (
                <Circle
                  className={cn(
                    "size-1.5",
                    error
                      ? "fill-destructive text-destructive"
                      : "fill-background text-muted-foreground/70 dark:text-border",
                  )}
                />
              )}
            </span>
            <ToolPart tool={tool} />
          </div>
        );
      })}
    </div>
  );
}
