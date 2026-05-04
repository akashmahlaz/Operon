"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  MessageSquare,
  Globe,
  Search,
  Plus,
  Trash2,
  MessageCircle,
  Send,
  Wifi,
  Settings2,
  QrCode,
  Power,
  X,
  File as FileIcon,
  Loader2,
  Phone,
  Users,
  ChevronRight,
  ChevronLeft,
  Shield,
  PanelLeft,
  Code2,
  PenLine,
  GraduationCap,
  Coffee,
  Mail,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { BlurFade } from "@/components/ui/blur-fade";
import { Ripple } from "@/components/ui/ripple";
import { ShineBorder } from "@/components/ui/shine-border";
import AI_Input_Search, {
  type PromptModelOption,
  type ReasoningLevel,
} from "@/components/kokonutui/ai-input-search";
import { StreamingChatMessageList } from "@/components/chat/message/streaming-message";
import { useStreamEvents } from "@/hooks/use-stream-events";
import type { ContentPartType, StreamPart, StreamingMessage, ToolCallEvent } from "@/hooks/use-stream-events/types";
import { isToolState } from "@/hooks/use-stream-events/types";
import { isModelProvider, type ProviderMeta } from "@/components/dashboard/settings/provider-catalog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConversationSummary {
  _id: string;
  title: string;
  channel: "web" | "whatsapp" | "telegram";
  lastMessage?: string | null;
  updatedAt: string;
  createdAt: string;
}

const CHANNEL_META: Record<
  string,
  { label: string; icon: typeof Globe; dotColor: string; bgColor: string; description: string }
> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-50 text-emerald-600",
    description: "End-to-end encrypted messaging",
  },
  web: {
    label: "Web Chat",
    icon: Globe,
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-50 text-blue-600",
    description: "Always available in browser",
  },
  telegram: {
    label: "Telegram",
    icon: Send,
    dotColor: "bg-sky-500",
    bgColor: "bg-sky-50 text-sky-600",
    description: "Bot-based messaging",
  },
};

interface AttachedFile {
  file: File;
  preview?: string;
  uploading?: boolean;
  url?: string;
  error?: string;
}

const streamPartTypes = new Set<ContentPartType>([
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "tool-call-start",
  "tool-call-input-streaming",
  "tool-call-input-available",
  "tool-call-execute",
  "tool-call-output-available",
  "tool-call-output-error",
  "tool-call-end",
  "text-delta",
  "text-end",
  "source-url",
]);

function hydrateMessageParts(messageId: string, parts: unknown[] | undefined, fallbackText: string): StreamPart[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [{ id: `${messageId}-0`, type: "text-delta", text: fallbackText }];
  }

  const hydrated = parts.flatMap((part, index): StreamPart[] => {
    if (!part || typeof part !== "object") return [];
    const raw = part as Record<string, unknown>;
    const type = typeof raw.type === "string" ? raw.type : "";
    const id = typeof raw.id === "string" ? raw.id : `${messageId}-${index}`;

    if (streamPartTypes.has(type as ContentPartType)) {
      if (type.startsWith("reasoning")) {
        return [{ id, type: type as "reasoning-start" | "reasoning-delta" | "reasoning-end", text: typeof raw.text === "string" ? raw.text : "" }];
      }
      if (type.startsWith("tool-call")) {
        const state = typeof raw.state === "string" && isToolState(raw.state) ? raw.state : "output-available";
        return [{
          id,
          type: type as ToolCallEvent["type"],
          toolCallId: typeof raw.toolCallId === "string" ? raw.toolCallId : id,
          toolName: typeof raw.toolName === "string" ? raw.toolName : "tool",
          state,
          args: raw.args && typeof raw.args === "object" ? raw.args as Record<string, unknown> : undefined,
          result: raw.result,
          errorText: typeof raw.errorText === "string" ? raw.errorText : undefined,
        }];
      }
      if (type === "source-url") {
        return [{ id, type: "source-url", url: typeof raw.url === "string" ? raw.url : "", title: typeof raw.title === "string" ? raw.title : undefined }];
      }
      return [{ id, type: type as "text-delta" | "text-end", text: typeof raw.text === "string" ? raw.text : "" }];
    }

    if (type === "text") return [{ id, type: "text-delta", text: typeof raw.text === "string" ? raw.text : "" }];
    if (type === "reasoning") return [{ id, type: "reasoning-delta", text: typeof raw.text === "string" ? raw.text : typeof raw.reasoning === "string" ? raw.reasoning : "" }];
    return [];
  });

  return hydrated.length > 0 ? hydrated : [{ id: `${messageId}-0`, type: "text-delta", text: fallbackText }];
}


function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConvId = searchParams.get("id") || undefined;
  const { data: session } = useSession();
  const userName = session?.user?.name?.split(" ")[0] ?? "there";

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Morning";
    if (h < 17) return "Afternoon";
    return "Evening";
  }

  const convIdRef = useRef<string | null>(null);


  const {
    messages: chatMessages,
    sendMessage,
    status,
    stop: stopChat,
    setMessages: setChatMessages,
    error: chatError,
  } = useStreamEvents({
    api: "/api/chat",
    conversationId: convIdRef.current ?? undefined,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const messages = chatMessages;

  useEffect(() => {
    if (chatError) toast.error(chatError.message);
  }, [chatError]);

  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<string>("web");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelStatus, setChannelStatus] = useState<Record<string, boolean>>({
    web: true,
    whatsapp: false,
    telegram: false,
  });
  const [waSettings, setWaSettings] = useState<{
    numberType: "personal" | "dedicated" | null;
    accessMode: "all" | "specific" | null;
    allowedNumbers: string;
  }>({ numberType: null, accessMode: null, allowedNumbers: "" });
  const [channelPanelOpen, setChannelPanelOpen] = useState(false);
  const [channelPanelView, setChannelPanelView] =
    useState<"list" | "whatsapp-connect" | "whatsapp-settings" | "telegram-connect">("list");
  const [waQrSession, setWaQrSession] = useState<{
    sessionId: string;
    qrDataUrl: string | null;
    message: string;
  } | null>(null);
  const [waConnecting, setWaConnecting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>("auto");
  const [providers, setProviders] = useState<ProviderMeta[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    convIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    fetch("/api/providers", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers || []);
        if (typeof data.defaultModel === "string" && data.defaultModel) {
          setSelectedModel(data.defaultModel);
        }
      })
      .catch(() => {});
  }, []);

  const connectedProviders = useMemo(() => providers.filter((p) => p.configured && isModelProvider(p)), [providers]);
  const modelOptions: PromptModelOption[] = useMemo(() => connectedProviders.flatMap((provider) => {
    // Only show models that were actually fetched from the provider's API.
    // providers with modelsFromProfile === false still have the static catalog
    // placeholders — hide them until real discovery succeeds.
    if (!provider.modelsFromProfile) return [];
    return (provider.models ?? []).map((model) => ({
      value: `${provider.id}/${model}`,
      label: model,
      providerLabel: provider.name,
    }));
  }), [connectedProviders]);

  useEffect(() => {
    if (modelOptions.length === 0) {
      if (selectedModel) setSelectedModel("");
      return;
    }
    if (!modelOptions.some((model) => model.value === selectedModel)) {
      setSelectedModel(modelOptions[0].value);
    }
  }, [modelOptions, selectedModel]);

  /** Returns true only for providers/models that actually support thinking/reasoning cost control */
  function modelSupportsReasoning(spec: string): boolean {
    if (!spec.includes("/")) return false;
    const slashIdx = spec.indexOf("/");
    const providerId = spec.slice(0, slashIdx);
    const modelId = spec.slice(slashIdx + 1).toLowerCase();
    if (providerId === "openai") return /^o\d/.test(modelId); // o1, o3, o4, o1-mini, o3-mini, o4-mini
    if (providerId === "anthropic") {
      return (
        modelId.includes("3-7") ||
        modelId.startsWith("claude-sonnet-4") ||
        modelId.startsWith("claude-opus-4") ||
        modelId.startsWith("claude-haiku-4") ||
        modelId.startsWith("claude-4")
      );
    }
    if (providerId === "google") {
      return modelId.startsWith("gemini-2.5") || modelId.startsWith("gemini-3");
    }
    return false;
  }

  const primaryChannel = channelStatus.whatsapp
    ? "whatsapp"
    : channelStatus.telegram
      ? "telegram"
      : "whatsapp";

  const scrollToBottom = useCallback((instant = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? "instant" : "smooth" });
  }, []);

  const checkIfNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const handler = () => {
      const near = checkIfNearBottom();
      setIsNearBottom(near);
      setShowScrollBtn(!near);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [checkIfNearBottom]);

  useEffect(() => {
    if (isNearBottom) scrollToBottom();
  }, [messages, isNearBottom, scrollToBottom]);

  // Load conversations + channel status
  useEffect(() => {
    loadConversations();
    loadChannelStatus();
    const poll = setInterval(loadConversations, 8000);
    return () => clearInterval(poll);
  }, []);

  // Sync URL conversation id
  useEffect(() => {
    if (urlConvId && urlConvId !== conversationId) {
      loadConversation(urlConvId);
    } else if (!urlConvId && conversationId) {
      queueMicrotask(() => {
        setConversationId(null);
        setChatMessages([]);
        setActiveChannel("web");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConvId]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
  }

  async function loadChannelStatus() {
    try {
      const [waRes, tgRes] = await Promise.all([
        fetch("/api/whatsapp?action=status").then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/api/telegram?action=status").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      setChannelStatus({
        web: true,
        whatsapp: waRes?.connected ?? false,
        telegram: tgRes?.connected ?? false,
      });
    } catch {
      /* ignore */
    }
  }

  async function loadWaOnboarding() {
    try {
      const res = await fetch("/api/whatsapp?action=onboarding");
      if (!res.ok) return;
      const data = await res.json();
      setWaSettings({
        numberType: data.phoneType || null,
        accessMode: data.dmPolicy === "allowlist" ? "specific" : data.dmPolicy === "open" ? "all" : null,
        allowedNumbers: (data.allowFrom || []).filter((n: string) => n !== "*").join(", "),
      });
    } catch {
      /* ignore */
    }
  }

  async function saveWaSettings() {
    try {
      const dmPolicy =
        waSettings.accessMode === "specific"
          ? "allowlist"
          : waSettings.accessMode === "all"
            ? "open"
            : "pairing";
      const allowFrom =
        waSettings.accessMode === "specific"
          ? waSettings.allowedNumbers
              .split(",")
              .map((n) => n.trim().replace(/\D/g, ""))
              .filter(Boolean)
          : ["*"];
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "onboarding",
          phoneType: waSettings.numberType,
          dmPolicy,
          allowFrom,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("WhatsApp settings saved");
      setChannelPanelOpen(false);
    } catch {
      toast.error("Failed to save WhatsApp settings");
    }
  }

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/chat?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setConversationId(data._id);
      convIdRef.current = data._id;
      setActiveChannel(data.channel || "web");
      const loaded: StreamingMessage[] = (data.messages || [])
        .filter((m: { role: string; content?: string }) => m.role !== "system" || m.content)
        .map((m: { _id?: string; role: string; content: string; parts?: unknown[] }, i: number) => ({
          id: m._id ?? String(i),
          role: m.role as "user" | "assistant",
          orderedParts: hydrateMessageParts(m._id ?? String(i), m.parts, m.content || ""),
          isComplete: true,
          isStreaming: false,
        }));
      setChatMessages(loaded);
      requestAnimationFrame(() => scrollToBottom(true));
    } catch {
      toast.error("Failed to load conversation");
    }
  }

  async function createConversation(): Promise<string | null> {
    try {
      const res = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat", channel: activeChannel }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data._id);
        setActiveChannel("web");
        router.replace(`/dashboard/chat?id=${data._id}`);
        loadConversations();
        return data._id;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await fetch(`/api/chat?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (conversationId === id) router.push("/dashboard/chat");
      loadConversations();
    } catch {
      toast.error("Failed to delete");
    }
  }

  function startNewChat() {
    router.push("/dashboard/chat");
    setConversationId(null);
    setChatMessages([]);
    setActiveChannel("web");
    setInput("");
  }

    function handleFileClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10 MB)`);
        continue;
      }
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      const entry: AttachedFile = { file, preview, uploading: true };
      setAttachedFiles((prev) => [...prev, entry]);
      const formData = new FormData();
      formData.append("file", file);
      fetch("/api/upload", { method: "POST", body: formData })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Upload failed" }));
            throw new Error(err.error || "Upload failed");
          }
          const data = await res.json();
          setAttachedFiles((prev) =>
            prev.map((f) =>
              f.file === file ? { ...f, uploading: false, url: data.publicUrl || data.url } : f,
            ),
          );
        })
        .catch((err) => {
          setAttachedFiles((prev) =>
            prev.map((f) => (f.file === file ? { ...f, uploading: false, error: err.message } : f)),
          );
          toast.error(`Failed to upload ${file.name}`);
        });
    }
    e.target.value = "";
  }

  function removeAttachedFile(file: File) {
    setAttachedFiles((prev) => {
      const entry = prev.find((f) => f.file === file);
      if (entry?.preview) URL.revokeObjectURL(entry.preview);
      return prev.filter((f) => f.file !== file);
    });
  }

  async function startWhatsAppConnect() {
    setWaConnecting(true);
    setChannelPanelView("whatsapp-connect");
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "qr" }),
      });
      if (res.ok) {
        const data = await res.json();
        setWaQrSession(data);
      }
    } finally {
      setWaConnecting(false);
    }
  }

  async function disconnectWhatsApp() {
    try {
      await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      toast.success("WhatsApp disconnected");
      loadChannelStatus();
      setChannelPanelOpen(false);
    } catch {
      toast.error("Failed to disconnect");
    }
  }

  const handleSend = useCallback(async (overrideContent?: string) => {
    if (isLoading) return;
    let content = (overrideContent ?? input).trim();
    if (!content && attachedFiles.length === 0) return;
    if (!selectedModel) {
      toast.error("No API-backed model is available. Refresh or connect a provider in Settings.");
      return;
    }

    const uploadedFiles = attachedFiles.filter((f) => f.url);
    if (uploadedFiles.length > 0) {
      const fileSection = uploadedFiles
        .map((f) => `[${f.file.type.startsWith("image/") ? "Image" : "File"}: ${f.file.name}](${f.url})`)
        .join("\n");
      content = content ? `${content}\n\n${fileSection}` : fileSection;
    }

    setInput("");
    setAttachedFiles([]);
    setIsNearBottom(true);
    setShowScrollBtn(false);

    try {
      let activeConvId = conversationId;
      if (!activeConvId) activeConvId = await createConversation();
      convIdRef.current = activeConvId;

      // Build options object matching useStreamEvents signature
      const msgOpts = {
        conversationId: activeConvId,
        modelSpec: selectedModel,
        reasoningLevel,
        channel: activeChannel,
      };
      await sendMessage(content, msgOpts);
      loadConversations();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      toast.error(message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, conversationId, attachedFiles, sendMessage, selectedModel, reasoningLevel]);

    const isChannelConversation = activeChannel !== "web";

  const filteredConversations = searchQuery
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const groupedConversations = filteredConversations.reduce(
    (acc, c) => {
      const date = new Date(c.updatedAt);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = diff / (1000 * 3600 * 24);
      let group = "Older";
      if (days < 1 && date.getDate() === now.getDate()) group = "Today";
      else if (days < 2) group = "Yesterday";
      else if (days < 7) group = "Previous 7 Days";
      else if (days < 30) group = "Previous 30 Days";
      if (!acc[group]) acc[group] = [];
      acc[group].push(c);
      return acc;
    },
    {} as Record<string, typeof filteredConversations>,
  );

  const groupOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"];

  const primaryMeta = CHANNEL_META[primaryChannel] || CHANNEL_META.whatsapp;
  const PrimaryIcon = primaryMeta.icon;
  const connectedCount = Object.values(channelStatus).filter(Boolean).length;

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background">
      {/* ════════ MIDDLE COLUMN — Conversation list ════════ */}
      <div
        className={cn(
          "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-out md:flex",
          panelOpen ? "w-65" : "w-0 overflow-hidden border-r-0",
        )}
      >
        {/* Header */}
        <div className="shrink-0 space-y-2 px-3 pb-2 pt-3">
          <div className="flex items-center justify-between gap-1.5">
            <button
              onClick={startNewChat}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
            >
              <Plus className="size-3.5" />
              New Chat
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-border/60 bg-muted/40 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/30 focus:bg-background focus:outline-none"
            />
          </div>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted/60">
                <MessageSquare className="size-4.5 text-muted-foreground/50" />
              </div>
              <p className="text-[12.5px] font-medium text-muted-foreground">
                {searchQuery ? "No matching chats" : "No chats yet"}
              </p>
              {!searchQuery && (
                <p className="text-[11px] text-muted-foreground/60">Start a new conversation above</p>
              )}
            </div>
          ) : (
            <div className="space-y-3 pt-1.5">
              {groupOrder.map((group) => {
                if (!groupedConversations[group] || groupedConversations[group].length === 0)
                  return null;
                return (
                  <div key={group}>
                    <p className="mb-1 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      {group}
                    </p>
                    <div className="space-y-0.5">
                      {groupedConversations[group].map((c) => {
                        const isActive = conversationId === c._id;
                        return (
                          <button
                            key={c._id}
                            onClick={() => router.push(`/dashboard/chat?id=${c._id}`)}
                            className={cn(
                              "group relative w-full rounded-lg px-2.5 py-2 text-left transition-all",
                              isActive
                                ? "bg-primary/8 text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-r-full before:bg-primary"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                            )}
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className={cn(
                                    "truncate text-[12.5px]",
                                    isActive ? "font-semibold text-foreground" : "font-medium"
                                  )}>
                                    {c.title || "Untitled"}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                    {formatTimeAgo(c.updatedAt)}
                                  </span>
                                </div>
                                {c.lastMessage && (
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                                    {c.lastMessage}
                                  </p>
                                )}
                              </div>
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => deleteConversation(c._id, e)}
                                className="mt-0.5 shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground/30 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                              >
                                <Trash2 className="size-3" />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════════ RIGHT COLUMN — Chat area ════════ */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute left-4 right-4 top-3 z-10 flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2">
            {!panelOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setPanelOpen(true)}
                    className="rounded-lg border border-border bg-background/80 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <PanelLeft className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Show panel</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="hidden">
            <Popover
              open={channelPanelOpen}
              onOpenChange={(open) => {
                setChannelPanelOpen(open);
                if (open) setChannelPanelView("list");
              }}
            >
              <PopoverTrigger asChild>
                <button className="group relative flex items-center gap-2.5 overflow-hidden rounded-full border border-border bg-card py-2 pl-3.5 pr-4 text-sm transition-all duration-300 hover:border-primary/30 hover:shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                  <span className="absolute inset-0 bg-linear-to-r from-emerald-500/5 via-transparent to-primary/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="relative flex items-center gap-2.5">
                    <span className="relative flex size-2.5">
                      {channelStatus.whatsapp ? (
                        <>
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                        </>
                      ) : (
                        <span className="relative inline-flex size-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/20" />
                      )}
                    </span>
                    <PrimaryIcon className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                    <span className="font-semibold tracking-tight text-foreground">
                      {channelStatus.whatsapp ? "WhatsApp" : "Connect"}
                    </span>
                    <span className="h-3.5 w-px bg-border" />
                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                      {connectedCount}/{Object.keys(CHANNEL_META).length}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground transition-colors group-hover:text-foreground" />
                  </span>
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-85 overflow-hidden rounded-2xl border-border/80 p-0 shadow-[0_16px_70px_-12px_rgba(0,0,0,0.12)]"
              >
                {channelPanelView === "list" && (
                  <div>
                    <div className="px-4 pb-3 pt-4">
                      <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                        Channels
                      </h3>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Connect platforms to Operon AI
                      </p>
                    </div>

                    <div className="space-y-1 px-2 pb-2">
                      {Object.entries(CHANNEL_META).map(([key, meta], idx) => {
                        const connected = channelStatus[key] ?? false;
                        const Icon = meta.icon;
                        const isWeb = key === "web";
                        return (
                          <BlurFade key={key} delay={0.05 * idx} direction="up">
                            <button
                              onClick={() => {
                                if (isWeb) return;
                                if (key === "whatsapp") {
                                  if (connected) {
                                    loadWaOnboarding();
                                    setChannelPanelView("whatsapp-settings");
                                  } else {
                                    startWhatsAppConnect();
                                  }
                                } else if (key === "telegram") {
                                  setChannelPanelView("telegram-connect");
                                }
                              }}
                              className={cn(
                                "relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left transition-all duration-200",
                                isWeb
                                  ? "cursor-default"
                                  : connected
                                    ? "cursor-pointer hover:bg-emerald-500/5"
                                    : "cursor-pointer hover:bg-accent",
                              )}
                            >
                              <div
                                className={cn(
                                  "relative flex size-10 shrink-0 items-center justify-center rounded-xl",
                                  meta.bgColor,
                                )}
                              >
                                <Icon className="size-4" />
                                {connected && !isWeb && (
                                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-emerald-500" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className="text-[13px] font-semibold text-foreground">
                                    {meta.label}
                                  </p>
                                  {isWeb && (
                                    <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600">
                                      ALWAYS ON
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {connected
                                    ? meta.description
                                    : isWeb
                                      ? meta.description
                                      : "Tap to connect"}
                                </p>
                              </div>
                              {connected && !isWeb ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-[10px] font-bold text-emerald-600">Live</span>
                                  <span className="text-[9px] text-muted-foreground">Connected</span>
                                </div>
                              ) : isWeb ? (
                                <Wifi className="size-4 text-blue-500/70" />
                              ) : (
                                <div className="flex items-center gap-1 text-[11px] font-medium text-primary">
                                  Setup
                                  <ChevronRight className="size-3" />
                                </div>
                              )}
                              {connected && !isWeb && (
                                <BorderBeam
                                  size={40}
                                  duration={3}
                                  colorFrom="#25D366"
                                  colorTo="#128C7E"
                                  borderWidth={1.5}
                                />
                              )}
                            </button>
                          </BlurFade>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{connectedCount}</span> of{" "}
                        {Object.keys(CHANNEL_META).length} active
                      </p>
                      <button
                        onClick={() => {
                          setChannelPanelOpen(false);
                          router.push("/dashboard/integrations");
                        }}
                        className="text-[10px] font-medium text-primary hover:underline"
                      >
                        Manage all →
                      </button>
                    </div>
                  </div>
                )}

                {channelPanelView === "whatsapp-connect" && (
                  <div>
                    <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
                      <button
                        onClick={() => setChannelPanelView("list")}
                        className="rounded-lg p-1 transition-colors hover:bg-accent"
                      >
                        <ChevronDown className="size-3.5 rotate-90 text-muted-foreground" />
                      </button>
                      <div>
                        <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                          Connect WhatsApp
                        </h3>
                        <p className="text-[11px] text-muted-foreground">Link your WhatsApp account</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      {waQrSession?.qrDataUrl ? (
                        <BlurFade delay={0.1} direction="up">
                          <div className="flex flex-col items-center gap-4">
                            <div className="relative overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={waQrSession.qrDataUrl} alt="WhatsApp QR" className="size-52" />
                              <BorderBeam size={80} duration={4} colorFrom="#25D366" colorTo="#075E54" />
                            </div>
                            <p className="text-[13px] font-semibold text-foreground">
                              Scan with WhatsApp
                            </p>
                          </div>
                        </BlurFade>
                      ) : waConnecting ? (
                        <div className="relative flex flex-col items-center justify-center overflow-hidden py-10">
                          <Ripple mainCircleSize={80} numCircles={4} mainCircleOpacity={0.12} />
                          <div className="relative z-10 flex flex-col items-center gap-3">
                            <div className="flex size-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50">
                              <Loader2 className="size-6 animate-spin text-emerald-600" />
                            </div>
                            <p className="text-[12px] font-medium text-muted-foreground">
                              Generating QR code…
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-4 py-6">
                          <div className="relative flex size-14 items-center justify-center overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50">
                            <QrCode className="size-6 text-emerald-600" />
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-medium text-foreground">Ready to connect</p>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {waQrSession?.message ||
                                "Generate a QR code to link your WhatsApp"}
                            </p>
                          </div>
                          <Button size="sm" onClick={startWhatsAppConnect} className="rounded-xl px-5">
                            <QrCode className="mr-1.5 size-3.5" />
                            Generate QR Code
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {channelPanelView === "whatsapp-settings" && (
                  <div>
                    <div className="relative overflow-hidden px-4 pb-3 pt-4">
                      <div className="absolute inset-0 bg-linear-to-br from-emerald-500/5 to-transparent" />
                      <div className="relative flex items-center gap-2.5">
                        <button
                          onClick={() => setChannelPanelView("list")}
                          className="rounded-lg p-1 transition-colors hover:bg-accent"
                        >
                          <ChevronDown className="size-3.5 rotate-90 text-muted-foreground" />
                        </button>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50">
                          <MessageCircle className="size-4 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                              WhatsApp
                            </h3>
                            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                              Connected
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Receiving messages</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4 px-4 pb-4">
                      <BlurFade delay={0.05} direction="up">
                        <div className="space-y-2">
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                            <Phone className="size-3" />
                            Number type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                { value: "personal", label: "Personal", desc: "Daily number", icon: Phone },
                                {
                                  value: "dedicated",
                                  label: "Dedicated",
                                  desc: "Operon only",
                                  icon: Shield,
                                },
                              ] as const
                            ).map((opt) => {
                              const active = waSettings.numberType === opt.value;
                              return (
                                <MagicCard
                                  key={opt.value}
                                  gradientColor={
                                    active ? "rgba(37, 211, 102, 0.08)" : "rgba(0,0,0,0.03)"
                                  }
                                  gradientSize={150}
                                  className="cursor-pointer p-0!"
                                >
                                  <button
                                    onClick={() =>
                                      setWaSettings((s) => ({ ...s, numberType: opt.value }))
                                    }
                                    className={cn(
                                      "relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition-all",
                                      active
                                        ? "border-emerald-500/50 bg-emerald-500/5"
                                        : "border-border hover:border-primary/20",
                                    )}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div
                                        className={cn(
                                          "flex size-7 shrink-0 items-center justify-center rounded-lg",
                                          active
                                            ? "bg-emerald-500/15 text-emerald-600"
                                            : "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        <opt.icon className="size-3.5" />
                                      </div>
                                      <div>
                                        <p
                                          className={cn(
                                            "text-[12px] font-semibold",
                                            active ? "text-emerald-700" : "text-foreground",
                                          )}
                                        >
                                          {opt.label}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                                          {opt.desc}
                                        </p>
                                      </div>
                                    </div>
                                    {active && (
                                      <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-emerald-500">
                                        <Check className="size-2.5 text-white" />
                                      </span>
                                    )}
                                  </button>
                                </MagicCard>
                              );
                            })}
                          </div>
                        </div>
                      </BlurFade>

                      <BlurFade delay={0.1} direction="up">
                        <div className="space-y-2">
                          <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                            <Users className="size-3" />
                            Who can message AI?
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {(
                              [
                                { value: "all", label: "Everyone", desc: "All contacts", icon: Users },
                                { value: "specific", label: "Specific", desc: "Whitelist", icon: Shield },
                              ] as const
                            ).map((opt) => {
                              const active = waSettings.accessMode === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() =>
                                    setWaSettings((s) => ({ ...s, accessMode: opt.value }))
                                  }
                                  className={cn(
                                    "relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition-all",
                                    active
                                      ? "border-emerald-500/50 bg-emerald-500/5"
                                      : "border-border hover:border-primary/20",
                                  )}
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div
                                      className={cn(
                                        "flex size-7 shrink-0 items-center justify-center rounded-lg",
                                        active
                                          ? "bg-emerald-500/15 text-emerald-600"
                                          : "bg-muted text-muted-foreground",
                                      )}
                                    >
                                      <opt.icon className="size-3.5" />
                                    </div>
                                    <div>
                                      <p
                                        className={cn(
                                          "text-[12px] font-semibold",
                                          active ? "text-emerald-700" : "text-foreground",
                                        )}
                                      >
                                        {opt.label}
                                      </p>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        {opt.desc}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </BlurFade>

                      {waSettings.accessMode === "specific" && (
                        <BlurFade delay={0.15} direction="up">
                          <div className="space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                              Allowed numbers
                            </label>
                            <input
                              type="text"
                              placeholder="+91 98765 43210, +1 555 0123"
                              value={waSettings.allowedNumbers}
                              onChange={(e) =>
                                setWaSettings((s) => ({ ...s, allowedNumbers: e.target.value }))
                              }
                              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] text-foreground transition-all placeholder:text-muted-foreground focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                            />
                          </div>
                        </BlurFade>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 rounded-xl bg-emerald-600 text-[12px] font-semibold text-white shadow-sm hover:bg-emerald-700"
                          onClick={saveWaSettings}
                          disabled={!waSettings.numberType || !waSettings.accessMode}
                        >
                          <Check className="mr-1.5 size-3" />
                          Save settings
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={disconnectWhatsApp}
                        >
                          <Power className="mr-1 size-3" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {channelPanelView === "telegram-connect" && (
                  <div>
                    <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
                      <button
                        onClick={() => setChannelPanelView("list")}
                        className="rounded-lg p-1 transition-colors hover:bg-accent"
                      >
                        <ChevronDown className="size-3.5 rotate-90 text-muted-foreground" />
                      </button>
                      <div>
                        <h3 className="font-heading text-[15px] font-bold tracking-tight text-foreground">
                          Connect Telegram
                        </h3>
                        <p className="text-[11px] text-muted-foreground">Set up your bot</p>
                      </div>
                    </div>
                    <div className="px-4 pb-4">
                      <div className="flex flex-col items-center gap-4 py-4">
                        <div className="flex size-14 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50">
                          <Send className="size-6 text-sky-600" />
                        </div>
                        <p className="max-w-55 text-center text-[12px] text-muted-foreground">
                          Configure Telegram with your bot token in Channel Settings
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-[12px]"
                          onClick={() => {
                            setChannelPanelOpen(false);
                            router.push("/dashboard/integrations");
                          }}
                        >
                          <Settings2 className="mr-1.5 size-3" />
                          Open Channel Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* ─── Messages ───────────────────────────────────────────── */}
        <div ref={messagesContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {messages.length === 0 && !conversationId && (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
                {/* Greeting */}
                <div className="flex items-center gap-3">
                  <Sparkles className="size-9 shrink-0 text-primary" />
                  <h1 className="font-heading text-[32px] font-semibold tracking-tight text-foreground sm:text-[40px]">
                    {getGreeting()}, {userName}
                  </h1>
                </div>
                {/* Suggestion chips */}
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { icon: Code2, label: "Code" },
                    { icon: PenLine, label: "Write" },
                    { icon: GraduationCap, label: "Learn" },
                    { icon: Coffee, label: "Life stuff" },
                    { icon: Mail, label: "From Gmail" },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setInput(label === "Code" ? "Help me write code for " : label === "Write" ? "Write a " : label === "Learn" ? "Explain " : label === "Life stuff" ? "Help me with " : "Summarise my last 5 emails")}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/80 shadow-xs transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground"
                    >
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length === 0 && conversationId && (
              <div className="flex min-h-[40vh] flex-col items-center justify-center">
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              </div>
            )}

            {isChannelConversation && conversationId && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200/40 bg-blue-50/80 px-3.5 py-2 text-xs text-blue-700">
                <Globe className="size-3.5 shrink-0" />
                Viewing {CHANNEL_META[activeChannel]?.label} conversation — replies are sent via{" "}
                {CHANNEL_META[activeChannel]?.label}
              </div>
            )}

            <StreamingChatMessageList
              messages={chatMessages as StreamingMessage[]}
              isLoading={isLoading}
            />

            <div ref={messagesEndRef} className="h-px" aria-hidden="true" />
          </div>
        </div>

        {showScrollBtn && (
          <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
            <ShineBorder
              shineColor={["hsl(var(--primary))", "hsl(var(--muted-foreground))"]}
              borderWidth={1}
              duration={6}
              className="rounded-full p-0!"
            >
              <Button
                onClick={() => scrollToBottom()}
                size="icon"
                variant="outline"
                className="size-8 rounded-full border-0 bg-card/90 text-muted-foreground shadow-md hover:bg-card"
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </ShineBorder>
          </div>
        )}

        {/* ─── Input ───── */}
        <div className="shrink-0 bg-linear-to-t from-background via-background to-transparent px-4 pb-3 pt-2">
          <div className="relative mx-auto max-w-3xl">
            <div className="relative flex flex-col rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 focus-within:border-primary/30 focus-within:shadow-md">
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-2 pt-4">
                  {attachedFiles.map((af, i) => (
                    <div
                      key={i}
                      className="group relative flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm"
                    >
                      {af.preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={af.preview} alt="" className="size-9 rounded-lg object-cover" />
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileIcon className="size-4" />
                        </div>
                      )}
                      <div className="min-w-0 pr-1">
                        <p className="max-w-32 truncate font-medium text-foreground">
                          {af.file.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {af.uploading
                            ? "Uploading…"
                            : af.error
                              ? af.error
                              : `${(af.file.size / 1024).toFixed(0)} KB`}
                        </p>
                      </div>
                      {af.uploading && (
                        <Loader2 className="mr-1 size-3.5 shrink-0 animate-spin text-primary" />
                      )}
                      <button
                        onClick={() => removeAttachedFile(af.file)}
                        className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-border text-muted-foreground opacity-0 shadow-sm transition-all hover:bg-destructive hover:text-white group-hover:opacity-100"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.csv,.md,.json,.doc,.docx,.xls,.xlsx"
                />
                <AI_Input_Search
                  value={input}
                  models={modelOptions}
                  selectedModel={selectedModel}
                  disabled={isChannelConversation}
                  isLoading={isLoading}
                  reasoningLevel={reasoningLevel}
                  reasoningSupported={modelSupportsReasoning(selectedModel)}
                  onModelChange={setSelectedModel}
                  onReasoningLevelChange={setReasoningLevel}
                  onAttach={handleFileClick}
                  onChange={(value) => setInput(value)}
                  onSubmit={(value) => handleSend(value)}
                  onStop={stopChat}
                  placeholder={
                    isChannelConversation
                      ? `Viewing ${CHANNEL_META[activeChannel]?.label} conversation`
                      : "Message Operon..."
                  }
                  className="flex-1"
                />
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Operon can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPageWrapper() {
  return (
    <Suspense fallback={<div className="h-svh" />}>
      <ChatPage />
    </Suspense>
  );
}
