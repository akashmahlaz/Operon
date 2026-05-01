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
    <Avatar className="h-8 w-8 shrink-0 rounded-xl border border-border/40">
      <AvatarFallback
        className={cn(
          "rounded-xl text-[11px] font-semibold",
          isUser ? "bg-muted text-foreground/80" : "bg-foreground text-background",
        )}
      >
        {isUser ? "U" : <Sparkles className="h-3.5 w-3.5" />}
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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-foreground text-background">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          What can I do for you today?
        </h2>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Ask anything. Brilion picks the right tools and runs the steps for you.
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
