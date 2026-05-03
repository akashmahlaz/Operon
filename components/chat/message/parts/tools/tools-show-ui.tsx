// Renders a tool invocation badge. Accepts either { toolName, state } at
// the root, or the older { toolInvocation: { toolName, state } } envelope.

import { AlertCircle, Check, FileCode2, Github, Loader2, MessageSquareText, PencilLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const toolLabels: Record<string, string> = {
  web_search: "Searching the web",
  generate_image: "Generating image",
  generate_video: "Generating video",
  text_to_speech: "Converting to speech",
  memory_recall: "Recalling memory",
  memory_index: "Saving to memory",
  github_read_file: "Reading GitHub file",
  github_write_file: "Writing to GitHub",
  spawn_subagent: "Delegating to sub-agent",
  code_execute: "Running code",
  whatsapp_send: "Sending on WhatsApp",
};

type ToolLike = {
  toolInvocation?: ToolInvocationLike;
  toolName?: string;
  name?: string;
  state?: string;
  status?: string;
};

type ToolInvocationLike = Omit<ToolLike, "toolInvocation">;

function toToolLike(value: unknown): ToolLike {
  if (value && typeof value === "object") return value as ToolLike;
  return {};
}

function toolIcon(toolName: string, isPending: boolean, isError: boolean) {
  if (isPending) return Loader2;
  if (isError) return AlertCircle;
  if (toolName.includes("github")) return Github;
  if (toolName.includes("search")) return Search;
  if (toolName.includes("write") || toolName.includes("edit")) return PencilLine;
  if (toolName.includes("file") || toolName.includes("code")) return FileCode2;
  if (toolName.includes("message") || toolName.includes("chat") || toolName.includes("whatsapp")) return MessageSquareText;
  return Check;
}

export default function ToolPart({ tool }: { tool: unknown }) {
  const toolLike = toToolLike(tool);
  const inv = toolLike.toolInvocation ?? toolLike;
  const toolName = inv.toolName ?? inv.name ?? "tool";
  const state = inv.state ?? inv.status ?? "result";

  const label = toolLabels[toolName] ?? toolName;
  const isPending =
    state === "call" || state === "pending" || state === "input-streaming";
  const isError = state === "error" || state === "failed";
  const Icon = toolIcon(toolName, isPending, isError);

  return (
    <div className="flex items-start gap-2.5 py-1.5 text-[13px] text-muted-foreground">
      {isPending ? (
        <Icon className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground/70" />
      ) : isError ? (
        <Icon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      ) : (
        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
      )}
      <span className={cn("min-w-0 truncate", isError && "text-destructive")}>
        {isPending ? `${label}…` : label}
      </span>
    </div>
  );
}
