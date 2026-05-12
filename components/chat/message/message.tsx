"use client";

import { useState } from "react";
import { Check, ChevronRight, Circle, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OperonMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { ChatDisplayMessage, ParsedAttachment, ToolCallPart } from "@/components/chat/message/types";
import { FilePartList } from "@/components/chat/message/parts/file-part";
import { ReasoningPart } from "@/components/chat/message/parts/reasoning-part";
import { TextPart } from "@/components/chat/message/parts/text-part";
import { describeTool, ToolPartList } from "@/components/chat/message/parts/tool-part";

const ATTACHMENT_RE = /\[(Image|File):\s*([^\]]+)\]\(([^)]+)\)/g;
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

function parseMessageContent(content: string): { text: string; attachments: ParsedAttachment[] } {
  const attachments: ParsedAttachment[] = [];
  const text = content
    .replace(ATTACHMENT_RE, (_, type, name, url) => {
      attachments.push({ type: type.toLowerCase() as "image" | "file", name: name.trim(), url });
      return "";
    })
    .trim();

  return { text, attachments };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{copied ? "Copied!" : "Copy"}</TooltipContent>
    </Tooltip>
  );
}

function AssistantAvatar() {
  return (
    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
      <OperonMark className="size-4.5 text-foreground" />
    </div>
  );
}

function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Generating">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
    </span>
  );
}

function isToolActive(tool: ToolCallPart) {
  return isActiveToolState(tool.state);
}

function persistedToolLabel(tool: ToolCallPart) {
  const fallback = describeTool(tool.toolName, tool.args);
  const invocation = tool.invocationMessage?.includes(tool.toolName) ? undefined : tool.invocationMessage;
  const past = tool.pastTenseMessage?.includes(tool.toolName) ? undefined : tool.pastTenseMessage;
  return isToolActive(tool) ? invocation ?? fallback : past ?? invocation ?? fallback;
}

function derivePersistedThinkingTitle(tools: ToolCallPart[], hasReasoning: boolean, active: boolean) {
  const activeTool = [...tools].reverse().find(isToolActive);

  if (active) {
    return {
      title: tools.length || activeTool ? "Working" : "Thinking",
      detail: activeTool ? persistedToolLabel(activeTool) : undefined,
    };
  }

  if (!tools.length) {
    return { title: hasReasoning ? "Thought" : "Working" };
  }

  if (tools.length === 1) {
    return { title: persistedToolLabel(tools[0]) };
  }

  const allSearch = tools.every((tool) => /search|grep|find|list/i.test(tool.toolName));
  const allRead = tools.every((tool) => /read|get_file|list_dir/i.test(tool.toolName));
  if (allSearch) {
    return { title: `Searched for ${tools.length} things` };
  }
  if (allRead) {
    return { title: `Reviewed ${tools.length} files` };
  }
  return { title: `Finished with ${tools.length} steps` };
}

function AssistantThinkingRun({
  reasoningText,
  tools,
  streaming,
}: {
  reasoningText: string;
  tools: ToolCallPart[];
  streaming: boolean;
}) {
  const [open, setOpen] = useState(true);
  const hasReasoning = Boolean(reasoningText);
  const hasTools = tools.length > 0;
  const active = streaming || tools.some(isToolActive);
  const title = derivePersistedThinkingTitle(tools, hasReasoning, active);

  if (!hasReasoning && !hasTools && !active) return null;

  return (
    <div className="my-1 text-muted-foreground">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group/thinking inline-flex max-w-full items-center gap-1.5 py-0.5 text-[13px] leading-none text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        {active ? (
          <ActivePulseDot />
        ) : (
          <Check className="size-3 text-muted-foreground/75" />
        )}
        <span className={cn("truncate", active && "font-medium text-foreground/85")}>{title.title}</span>
        {title.detail && (
          <span className="min-w-0 truncate text-muted-foreground/65 animate-(--animate-pulse-soft)">
            {title.detail}
          </span>
        )}
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground/45 transition-transform group-hover/thinking:text-muted-foreground",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="relative mt-1 space-y-1">
          <span
            aria-hidden
            className="absolute left-1.25 -top-1 h-5 w-3 rounded-bl-[5px] border-l border-b border-muted-foreground/45 dark:border-border/80"
          />
          {hasReasoning && <ReasoningPart text={reasoningText} streaming={streaming} className="pl-6" />}
          <ToolPartList tools={tools} />
          {active && !hasReasoning && (
            <div className="relative py-1 pl-6 text-[12.5px] text-muted-foreground/80">
              <span
                aria-hidden
                className="absolute left-1.25 top-0 bottom-0 w-px bg-muted-foreground/55 dark:bg-border/85 mask-[linear-gradient(to_bottom,black_0_5px,transparent_5px_20px,black_20px_100%)]"
              />
              <span className="absolute left-0 top-2.5 flex size-3 items-center justify-center bg-background">
                <ActivePulseDot />
              </span>
              <span className="animate-(--animate-pulse-soft)">{title.detail ?? title.title}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PendingAssistantMessage({ thinking, isStreaming }: { thinking?: string; isStreaming: boolean }) {
  // Render the assistant placeholder immediately so the UI is streaming-shaped
  // (per AI SDK Streaming UI guidance) even before the first chunk arrives.
  return (
    <div className="flex max-w-3xl items-start gap-2.5 py-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        {thinking ? (
          <ReasoningPart text={thinking} streaming={isStreaming} />
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <StreamingDots />
            <span className="italic">Thinking…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SystemMessage({ message }: { message: ChatDisplayMessage }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
        {message.content}
      </span>
    </div>
  );
}

function UserMessage({ message }: { message: ChatDisplayMessage }) {
  const { text, attachments } = parseMessageContent(message.content);

  return (
    <div className="group flex flex-col items-end gap-1.5 py-2">
      <FilePartList attachments={attachments} />
      <TextPart text={text} isUser />
    </div>
  );
}

function AssistantMessage({ message, isLast, isLoading }: { message: ChatDisplayMessage; isLast: boolean; isLoading: boolean }) {
  const reasoningText = message.thinking || "";
  const isStreamingThis = isLoading && isLast;
  const showWaitingForText = isStreamingThis && !message.content;

  return (
    <div className="group flex max-w-3xl items-start gap-2.5 py-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <div className="space-y-2">
          <AssistantThinkingRun
            reasoningText={reasoningText}
            tools={message.toolCalls}
            streaming={isStreamingThis}
          />
          {message.content ? (
            <TextPart text={message.content} streaming={isStreamingThis} />
          ) : null}
          {showWaitingForText && !reasoningText && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StreamingDots />
              <span className="italic">Generating…</span>
            </div>
          )}
        </div>

        {message.content && !isStreamingThis && (
          <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessageRow({ message, isLast, isLoading }: { message: ChatDisplayMessage; isLast: boolean; isLoading: boolean }) {
  if (message.role === "system") return <SystemMessage message={message} />;
  if (message.role === "user") return <UserMessage message={message} />;
  return <AssistantMessage message={message} isLast={isLast} isLoading={isLoading} />;
}

export function ChatMessageList({ messages, isLoading }: { messages: ChatDisplayMessage[]; isLoading: boolean }) {
  const lastMsg = messages[messages.length - 1];
  const isStreaming = isLoading && lastMsg?.role === "user";
  return (
    <div className="flex flex-col gap-2 pb-4">
      {messages.map((message, index) => (
        <ChatMessageRow
          key={`${message.role}-${index}`}
          message={message}
          isLast={index === messages.length - 1}
          isLoading={isLoading}
        />
      ))}

      {isStreaming && <PendingAssistantMessage thinking={lastMsg?.thinking} isStreaming />}
    </div>
  );
}
