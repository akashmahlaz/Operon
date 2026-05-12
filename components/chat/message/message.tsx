"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { OperonMark } from "@/components/brand";
import type { ChatDisplayMessage, ParsedAttachment } from "@/components/chat/message/types";
import { FilePartList } from "@/components/chat/message/parts/file-part";
import { ReasoningPart } from "@/components/chat/message/parts/reasoning-part";
import { TextPart } from "@/components/chat/message/parts/text-part";
import { ToolPartList } from "@/components/chat/message/parts/tool-part";

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
          {reasoningText && (
            <ReasoningPart text={reasoningText} streaming={isStreamingThis} />
          )}
          <ToolPartList tools={message.toolCalls} />
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
