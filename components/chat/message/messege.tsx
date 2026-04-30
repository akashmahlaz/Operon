"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import TextPart from "./parts/textPart";
import ReasoningPart from "./parts/ai-reasoning";
import ToolPart from "./parts/tools/tools-show-ui";

function MessageAvatar({ role }: { role: string }) {
  const isUser = role === "user";
  return (
    <Avatar className="h-7 w-7 shrink-0 rounded-lg">
      <AvatarFallback
        className={cn(
          "rounded-lg text-[11px] font-medium",
          isUser ? "bg-muted text-foreground/70" : "bg-primary/10 text-primary",
        )}
      >
        {isUser ? "You" : <Sparkles className="h-3.5 w-3.5" />}
      </AvatarFallback>
    </Avatar>
  );
}

function PartRenderer({ part, role }: { part: any; role: string }) {
  const isUser = role === "user";
  switch (part.type) {
    case "text":
      return <TextPart text={part.text} isUser={isUser} />;
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

function MessageRow({ message }: { message: any }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <MessageAvatar role={message.role} />
      <div
        className={cn(
          "flex max-w-[78%] flex-col gap-2",
          isUser ? "items-end" : "items-start",
        )}
      >
        {message.parts?.map((part: any, i: number) => (
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          What can I do for you today?
        </h2>
        <p className="text-sm text-muted-foreground">
          Ask anything. Brilion will pick the right tools and run the steps.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <div
            key={s}
            className="cursor-pointer rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground/80 transition-colors hover:border-foreground/30 hover:bg-muted/50"
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
