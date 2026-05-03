import {
  AlertCircle,
  Check,
  Circle,
  FileCode2,
  GitBranch,
  Loader2,
  MessageSquareText,
  PencilLine,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart } from "@/components/chat/message/types";

const TOOL_LABELS: Record<string, string> = {
  tavily_search: "Searching the web",
  web_search: "Searching the web",
  generate_image: "Generating image",
  generate_video: "Generating video",
  text_to_speech: "Converting to speech",
  spawn_subagent: "Delegating to sub-agent",
  web_request: "Making web request",
  memory_search: "Searching memory",
  discover_skills: "Discovering skills",
  github_read_file: "Reading GitHub file",
  github_write_file: "Editing GitHub file",
  github_list_prs: "Reading pull requests",
  github_create_pr: "Creating pull request",
  github_list_issues: "Reading issues",
  github_create_issue: "Creating issue",
  github_search_code: "Searching GitHub code",
  github_create_branch: "Creating branch",
  github_push_files: "Pushing files",
};

export function getToolLabel(toolName: string) {
  return TOOL_LABELS[toolName] || toolName;
}

function toolStateLabel(state: ToolCallPart["state"]) {
  switch (state) {
    case "input-streaming":
      return "Preparing";
    case "input-available":
      return "Calling";
    case "output-available":
    case "result":
      return "Done";
    case "output-error":
    case "error":
      return "Error";
    case "calling":
    default:
      return "Working";
  }
}

function toolIcon(toolName: string, state: ToolCallPart["state"]) {
  const pending = ["calling", "input-streaming", "input-available"].includes(state);
  const error = state === "error" || state === "output-error";

  if (pending) return Loader2;
  if (error) return AlertCircle;
  if (toolName.includes("github")) return GitBranch;
  if (toolName.includes("search")) return Search;
  if (toolName.includes("write") || toolName.includes("edit") || toolName.includes("push")) return PencilLine;
  if (toolName.includes("file") || toolName.includes("code")) return FileCode2;
  if (toolName.includes("branch") || toolName.includes("pr")) return GitBranch;
  if (toolName.includes("message") || toolName.includes("chat")) return MessageSquareText;
  return Check;
}

function summarizeValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const path = record.path ?? record.filePath ?? record.filename;
  const query = record.query ?? record.search;
  const owner = record.owner;
  const repo = record.repo;

  if (typeof path === "string") return path;
  if (typeof query === "string") return query.length > 56 ? `${query.slice(0, 56)}...` : query;
  if (typeof owner === "string" && typeof repo === "string") return `${owner}/${repo}`;
  return null;
}

export function ToolPart({ tool }: { tool: ToolCallPart }) {
  const pending = ["calling", "input-streaming", "input-available"].includes(tool.state);
  const error = tool.state === "error" || tool.state === "output-error";
  const Icon = toolIcon(tool.toolName, tool.state);
  const detail = summarizeValue(tool.args) ?? summarizeValue(tool.result);

  return (
    <div className="group/tool relative flex items-start gap-2.5 py-1.5 text-[13px] text-muted-foreground">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
        {pending ? (
          <Icon className="size-3.5 animate-spin text-muted-foreground/70" />
        ) : error ? (
          <Icon className="size-3.5 text-destructive" />
        ) : (
          <Icon className="size-3.5 text-muted-foreground/70" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate", error && "text-destructive")}>
            {getToolLabel(tool.toolName)}
          </span>
          <span className="shrink-0 text-[12px] text-muted-foreground/55">
            {toolStateLabel(tool.state)}
          </span>
        </div>
        {detail && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground/50">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

export function ToolPartList({ tools }: { tools: ToolCallPart[] }) {
  if (!tools.length) return null;

  return (
    <div className="relative ml-0.5 border-l border-border/70 pl-3">
      {tools.map((tool, index) => (
        <div key={`${tool.toolName}-${index}`} className="relative">
          <span className="absolute -left-4 top-3 flex size-2 items-center justify-center bg-background">
            <Circle className="size-1.5 fill-background text-border" />
          </span>
          <ToolPart tool={tool} />
        </div>
      ))}
    </div>
  );
}
