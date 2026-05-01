import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallPart } from "@/components/chat/message/types";

const TOOL_LABELS: Record<string, string> = {
  tavily_search: "Searching the web",
  generate_image: "Generating image",
  generate_video: "Generating video",
  text_to_speech: "Converting to speech",
  spawn_subagent: "Delegating to sub-agent",
  web_request: "Making web request",
  memory_search: "Searching memory",
  discover_skills: "Discovering skills",
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

export function ToolPart({ tool }: { tool: ToolCallPart }) {
  const pending = ["calling", "input-streaming", "input-available"].includes(tool.state);
  const error = tool.state === "error" || tool.state === "output-error";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground",
        error ? "border-destructive/40 text-destructive" : "border-border/70 bg-muted/30",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin text-primary" />
      ) : error ? (
        <AlertCircle className="size-3" />
      ) : (
        <Check className="size-3 text-emerald-500" />
      )}
      <span>{getToolLabel(tool.toolName)}</span>
      <span className="text-muted-foreground/70">{toolStateLabel(tool.state)}</span>
    </div>
  );
}

export function ToolPartList({ tools }: { tools: ToolCallPart[] }) {
  if (!tools.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tools.map((tool, index) => (
        <ToolPart key={`${tool.toolName}-${index}`} tool={tool} />
      ))}
    </div>
  );
}
