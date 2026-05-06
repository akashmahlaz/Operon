"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Code2, Loader2, Plus, Square, Send, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StreamingChatMessageList } from "@/components/chat/message/streaming-message";
import { useStreamEvents } from "@/hooks/use-stream-events";
import type { StreamingMessage } from "@/hooks/use-stream-events/types";
import { hydrateMessageParts } from "@/lib/chat/hydrate-message-parts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ConversationDetail {
  _id: string;
  title: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    _id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    parts?: unknown[];
    createdAt: string;
  }>;
}

function CodingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");

  const [conversationId, setConversationId] = useState<string | null>(urlId);
  const [hydrating, setHydrating] = useState<boolean>(Boolean(urlId));
  const [input, setInput] = useState("");
  const ensuredRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
  } = useStreamEvents({
    api: "/api/chat",
    conversationId,
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  // Ensure we have a conversation id; create one on first mount if absent.
  useEffect(() => {
    if (ensuredRef.current) return;
    ensuredRef.current = true;
    if (urlId) return; // existing session — handled by hydration effect
    (async () => {
      const res = await fetch("/api/conversations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "coding", title: "Coding Session" }),
      });
      if (!res.ok) {
        toast.error("Failed to start a coding session");
        return;
      }
      const created = (await res.json()) as { _id: string };
      setConversationId(created._id);
      router.replace(`/dashboard/coding?id=${created._id}`);
    })();
  }, [urlId, router]);

  // Hydrate previous messages when ?id= present.
  useEffect(() => {
    if (!urlId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/conversations?id=${urlId}`);
        if (!res.ok) {
          if (!cancelled) setHydrating(false);
          return;
        }
        const data = (await res.json()) as ConversationDetail;
        if (cancelled) return;
        const hydrated: StreamingMessage[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "tool")
          .map((m) => ({
            id: m._id,
            role: m.role === "user" ? "user" : "assistant",
            orderedParts: hydrateMessageParts(m._id, m.parts, m.content ?? ""),
            isComplete: true,
            isStreaming: false,
          }));
        setMessages(hydrated);
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlId, setMessages]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const submit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !conversationId) return;
    sendMessage(trimmed, { conversationId, channel: "coding" });
    setInput("");
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [input, isLoading, conversationId, sendMessage]);

  const newSession = useCallback(async () => {
    const res = await fetch("/api/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "coding", title: "Coding Session" }),
    });
    if (!res.ok) {
      toast.error("Failed to start a new session");
      return;
    }
    const created = (await res.json()) as { _id: string };
    setMessages([]);
    setConversationId(created._id);
    router.replace(`/dashboard/coding?id=${created._id}`);
  }, [router, setMessages]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Code2 className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">Coding Session</span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              {conversationId ? (
                <span className="font-mono">workspaces/{conversationId.slice(0, 8)}…</span>
              ) : (
                "starting…"
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversationId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(`./workspaces/${conversationId}`)
                      .then(() => toast.success("Workspace path copied"));
                  }}
                >
                  <FolderOpen className="size-3.5" />
                  <span className="text-xs">Copy path</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Copy <span className="font-mono">./workspaces/{conversationId}</span>
              </TooltipContent>
            </Tooltip>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={newSession}>
            <Plus className="size-3.5" />
            <span className="text-xs">New session</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {hydrating ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span className="text-sm">Loading session…</span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState />
          ) : (
            <StreamingChatMessageList messages={messages} isLoading={isLoading} />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <div className="relative rounded-xl border border-border/60 bg-card shadow-sm focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30">
            <Textarea
              ref={composerRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={
                conversationId
                  ? "Tell the coding agent what to build, fix, or explore…"
                  : "Starting your workspace…"
              }
              disabled={!conversationId || hydrating}
              rows={2}
              className={cn(
                "min-h-15 resize-none border-0 bg-transparent px-4 py-3 pr-14 text-sm",
                "shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
              {isLoading ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 rounded-lg"
                  onClick={() => stop()}
                  title="Stop"
                >
                  <Square className="size-4 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={submit}
                  disabled={!input.trim() || !conversationId || hydrating}
                  title="Send"
                >
                  <Send className="size-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Enter to send · Shift+Enter for newline</span>
            <span className="font-mono">channel: coding · max 200 steps/turn</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  const examples = [
    "Build a Next.js todo app with Tailwind and SQLite persistence",
    "Scaffold a Rust CLI that converts Markdown to HTML using pulldown-cmark",
    "Create a small Express + TypeScript REST API with Vitest tests",
    "Initialise a Vite + React + shadcn project and add a working dashboard",
  ];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Code2 className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">Start a coding session</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The agent runs in an isolated per-conversation workspace and can read,
        write, patch, search, and execute commands. Long sessions are expected.
      </p>
      <div className="mt-6 grid w-full max-w-xl gap-2">
        {examples.map((ex) => (
          <div
            key={ex}
            className="rounded-lg border border-border/50 bg-card/50 px-3 py-2 text-left text-sm text-muted-foreground"
          >
            {ex}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CodingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          <span className="text-sm">Loading coding workspace…</span>
        </div>
      }
    >
      <CodingPageInner />
    </Suspense>
  );
}

