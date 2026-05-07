"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StreamingChatMessageList } from "@/components/chat/message/streaming-message";
import { CopilotComposer } from "@/components/chat/composer/copilot-composer";
import { useStreamEvents } from "@/hooks/use-stream-events";
import type { StreamingMessage } from "@/hooks/use-stream-events/types";
import { hydrateMessageParts } from "@/lib/chat/hydrate-message-parts";
import { toast } from "sonner";
import { operonFetch } from "@/lib/operon-api";
import { useOperonSession } from "@/components/ui/session-provider";

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

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get("id");
  const { user } = useOperonSession();
  const userName =
    user?.name?.split(" ")[0] ?? user?.display_name?.split(" ")[0] ?? "there";

  const [conversationId, setConversationId] = useState<string | null>(urlId);
  const [hydrating, setHydrating] = useState<boolean>(Boolean(urlId));
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const ensuredRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const {
    messages,
    sendMessage,
    status,
    stop,
    setMessages,
    error,
  } = useStreamEvents({
    api: "/agent/runs",
    conversationId,
    onResponse: (res) => {
      const cid = res.headers.get("X-Conversation-Id");
      if (cid && cid !== conversationId) {
        setConversationId(cid);
        router.replace(`/dashboard/chat?id=${cid}`);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  useEffect(() => {
    if (ensuredRef.current) return;
    ensuredRef.current = true;
  }, [urlId]);

  // Hydrate previous messages when ?id= present.
  useEffect(() => {
    if (!urlId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await operonFetch(`/agent/conversations/${urlId}`);
        if (!res.ok) {
          if (!cancelled) setHydrating(false);
          return;
        }
        const data = (await res.json()) as ConversationDetail;
        if (cancelled) return;
        const hydrated: StreamingMessage[] = data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m._id,
            role: m.role === "user" ? "user" : "assistant",
            orderedParts: hydrateMessageParts(
              m._id,
              Array.isArray(m.parts) ? (m.parts as unknown[]) : undefined,
              m.content ?? "",
            ),
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

  const newSessionLocal = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    ensuredRef.current = false;
    router.replace(`/dashboard/chat`);
  }, [router, setMessages]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      if (trimmed === "/new") {
        newSessionLocal();
        setInput("");
        return;
      }
      if (trimmed === "/clear") {
        setMessages([]);
        setInput("");
        return;
      }
      sendMessage(trimmed, { conversationId, channel: "web", modelSpec: model });
      setInput("");
    },
    [isLoading, conversationId, sendMessage, model, setMessages, newSessionLocal],
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MessageSquare className="size-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">Chat</span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {conversationId ? (
                <span className="font-mono">conversation/{conversationId.slice(0, 8)}…</span>
              ) : (
                "new conversation"
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={newSessionLocal}>
            <Plus className="size-3.5" />
            <span className="text-xs">New chat</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-3xl">
          {hydrating ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" />
              <span className="text-sm">Loading conversation…</span>
            </div>
          ) : messages.length === 0 ? (
            <EmptyState userName={userName} />
          ) : (
            <StreamingChatMessageList messages={messages} isLoading={isLoading} />
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border/40 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          <CopilotComposer
            value={input}
            onChange={setInput}
            onSubmit={submit}
            onStop={stop}
            isStreaming={isLoading}
            disabled={hydrating}
            placeholder={
              conversationId
                ? "Ask a follow-up, or /new to start over…"
                : "Ask anything — type / for commands, @ for participants, # to add context"
            }
            model={model}
            models={["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"]}
            onModelChange={setModel}
            toolsEnabled={toolsEnabled}
            onToolsToggle={setToolsEnabled}
            footerHint={`channel: web · max 8 steps/turn`}
          />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  const examples = [
    "Summarise the last 24 hours of activity across my connected accounts",
    "Draft a polite reply to the most recent email I haven't answered",
    "What's on my calendar today, and which meetings can I skip?",
    "Find the GitHub issues assigned to me and rank them by urgency",
  ];
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessageSquare className="size-6" />
      </div>
      <h2 className="text-lg font-semibold">
        {greeting()}, {userName}
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Ask anything. The agent can read your inbox, calendar, repos, and
        connected workspaces, take actions on your behalf, and explain its
        work step by step.
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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          <span className="text-sm">Loading chat…</span>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}

