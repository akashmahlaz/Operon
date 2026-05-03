"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { OperonMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import TextPart from "./parts/textPart";
import ReasoningPart from "./parts/ai-reasoning";
import ToolPart from "./parts/tools/tools-show-ui";

type ChatPart = {
  type: string;
  text?: string;
  reasoning?: string;
  toolInvocation?: unknown;
  [key: string]: unknown;
};

type ChatMessage = {
  id: string;
  role: string;
  parts?: ChatPart[];
};

function MessageAvatar({ role }: { role: string }) {
  const isUser = role === "user";
  if (isUser) return null;

  return (
    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
      <OperonMark className="size-4.5 text-foreground" />
    </div>
  );
}

function AssistantLabel() {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-normal text-muted-foreground/65">
      <span>Operon</span>
      <span className="h-px w-3 bg-border/70" />
    </div>
  );
}

function PartRenderer({ part, role }: { part: ChatPart; role: string }) {
  const isUser = role === "user";
  switch (part.type) {
    case "text":
      return <TextPart text={part.text ?? ""} isUser={isUser} />;
    case "reasoning":
      return <ReasoningPart text={part.text ?? part.reasoning ?? ""} />;
    case "tool-invocation":
    case "tool-call":
    case "tool-result":
      return <ToolPart tool={part} />;
    default:
      if (typeof part?.text === "string") {
        return <TextPart text={part.text} isUser={isUser} />;
      }
      return null;
  }
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <MessageAvatar role={message.role} />
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {!isUser && <AssistantLabel />}
        {message.parts?.map((part, i) => (
          <PartRenderer key={i} part={part} role={message.role} />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    "Draft a launch tweet for our v2",
    "Summarise my last 5 emails",
    "Schedule 30 min with Sara next week",
    "Watch BTCUSDT, alert me on a 3% drop",
  ];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Operon" className="h-14 w-14 object-contain mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          What can I do for you today?
        </h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Ask anything. Operon picks the right tools and runs the steps for you.
        </p>
      </div>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <div
            key={s}
            className="cursor-pointer rounded-xl border border-border/60 bg-card/60 p-3.5 text-left text-sm text-foreground/80 backdrop-blur transition-all hover:border-foreground/30 hover:bg-card hover:shadow-sm"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Message() {
  const { messages } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) return <EmptyState />;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
