"use client";

import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BlurFade } from "@/components/ui/blur-fade";
import type { ChatDisplayMessage, ParsedAttachment } from "@/components/chat/message/types";
import { FilePartList } from "@/components/chat/message/parts/file-part";
import { ReasoningPart } from "@/components/chat/message/parts/reasoning-part";
import { TextPart } from "@/components/chat/message/parts/text-part";
import { getToolLabel, ToolPartList } from "@/components/chat/message/parts/tool-part";

const ATTACHMENT_RE = /\[(Image|File):\s*([^\]]+)\]\(([^)]+)\)/g;

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
    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
      <Sparkles className="size-3.5 text-primary-foreground" />
    </div>
  );
}

function PendingAssistantMessage({ thinking, isStreaming }: { thinking?: string; isStreaming: boolean }) {
  // Show live reasoning inline — no separate "Thinking..." bubble
  return (
    <BlurFade delay={0.05} direction="up">
      <div className="flex max-w-3xl items-start gap-3 py-3">
        <AssistantAvatar />
        <div className="min-w-0 flex-1">
          <ReasoningPart text={thinking || ""} streaming={isStreaming} />
        </div>
      </div>
    </BlurFade>
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
  const hasToolCalls = message.toolCalls.length > 0;
  const derivedThinking =
    !message.thinking && hasToolCalls
      ? message.toolCalls
          .filter((toolCall) => ["calling", "input-streaming", "input-available"].includes(toolCall.state))
          .map((toolCall) => getToolLabel(toolCall.toolName))
          .join(" | ")
      : undefined;
  const reasoningText = message.thinking || (derivedThinking ? `Working on: ${derivedThinking}` : "");
  const isStreamingReasoning = isLoading && isLast && !message.content;

  return (
    <div className="group flex max-w-3xl items-start gap-3 py-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <div className="space-y-2">
          <ReasoningPart text={reasoningText} streaming={isStreamingReasoning && Boolean(reasoningText)} />
          <ToolPartList tools={message.toolCalls} />
          {message.content ? (
            <TextPart text={message.content} />
          ) : isLoading && isLast ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
              </div>
              <span className="text-xs">{hasToolCalls ? "Working…" : "Thinking…"}</span>
            </div>
          ) : null}
        </div>

        {message.content && (
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
