// Renders a tool invocation badge. Accepts either { toolName, state } at
// the root, or the older { toolInvocation: { toolName, state } } envelope.

import { Loader2, Check, AlertCircle } from "lucide-react";
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

export default function ToolPart({ tool }: { tool: any }) {
  const inv = tool.toolInvocation ?? tool;
  const toolName: string = inv.toolName ?? inv.name ?? "tool";
  const state: string = inv.state ?? inv.status ?? "result";

  const label = toolLabels[toolName] ?? toolName;
  const isPending =
    state === "call" || state === "pending" || state === "input-streaming";
  const isError = state === "error" || state === "failed";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-xs",
        isError
          ? "border-destructive/40 text-destructive"
          : "border-border text-foreground/70",
      )}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      ) : isError ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      )}
      <span className="font-mono">
        {isPending ? `${label}…` : label}
      </span>
    </div>
  );
}
