"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type {
  StreamingMessage,
  StreamPart,
  ReasoningPartEvent,
  ToolCallEvent,
  TextDeltaEvent,
  SourceUrlEvent,
  ProgressEvent,
  AnchorEvent,
  ReferenceEvent,
  CodeblockUriEvent,
  TextEditEvent,
  ConfirmationEvent,
  CommandButtonEvent,
  SubagentEvent,
  WarningEvent,
  UsageEvent,
} from "./types";
import { operonFetch } from "@/lib/operon-api";

// ---------------------------------------------------------------------------
// SSE event shape emitted by the Rust agent backend.
// The server sends custom JSON envelopes as SSE data frames.
// Vocabulary mirrors VS Code Copilot's ChatResponseStream.
// ---------------------------------------------------------------------------

type SSEEventType =
  | "reasoning-start"
  | "reasoning-delta"
  | "reasoning-end"
  | "tool-call-start"
  | "tool-call-update"
  | "tool-call-input-streaming"
  | "tool-call-input-available"
  | "tool-call-execute"
  | "tool-call-output-available"
  | "tool-call-output-error"
  | "tool-call-end"
  | "text-delta"
  | "text-end"
  | "codeblock-uri"
  | "text-edit"
  | "source-url"
  | "progress"
  | "anchor"
  | "reference"
  | "confirmation"
  | "command-button"
  | "subagent-start"
  | "subagent-progress"
  | "subagent-result"
  | "warning"
  | "usage"
  | "message-end"
  | "done"
  | "run-completed"
  | "run-failed"
  | "run-cancelled"
  | "error";

interface SSEEvent {
  type: SSEEventType;
  data: {
    id?: string;
    text?: string;
    toolCallId?: string;
    toolName?: string;
    invocationMessage?: string;
    pastTenseMessage?: string;
    originMessage?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    errorText?: string;
    url?: string;
    title?: string;
    uri?: string;
    line?: number;
    isEdit?: boolean;
    status?: "loading" | "success" | "error" | "omitted" | "partial" | "active" | "complete";
    progressStatus?: "active" | "complete" | "error";
    agentName?: string;
    prompt?: string;
    subagentStatus?: "active" | "complete" | "error";
    runId?: string;
    logUrl?: string;
    target?: string;
    edits?: unknown;
    isDone?: boolean;
    message?: string;
    data?: unknown;
    buttons?: string[];
    command?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ---------------------------------------------------------------------------
// Custom useChat — replaces @ai-sdk/react useChat for streaming events
// ---------------------------------------------------------------------------

interface UseStreamEventsOptions {
  api: string;
  conversationId?: string | null;
  onFinished?: (message: StreamingMessage) => void;
  /**
   * Called once with the raw fetch Response after the POST starts streaming.
   * Useful for reading server-assigned headers like `X-Conversation-Id`.
   */
  onResponse?: (res: Response) => void;
}

interface UseStreamEventsReturn {
  messages: StreamingMessage[];
  sendMessage: (text: string, opts?: {
    conversationId?: string | null;
    modelSpec?: string | null;
    reasoningLevel?: string;
    channel?: string;
  }) => void;
  stop: () => void;
  status: "idle" | "submitted" | "streaming" | "error";
  error: Error | null;
  setMessages: React.Dispatch<React.SetStateAction<StreamingMessage[]>>;
}

let _partIdCounter = 0;
function nextId() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `part-${++_partIdCounter}-${random}`;
}

export function useStreamEvents({
  api,
  conversationId,
  onFinished,
  onResponse,
}: UseStreamEventsOptions): UseStreamEventsReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [status, setStatus] = useState<
    "idle" | "submitted" | "streaming" | "error"
  >("idle");
  const [error, setError] = useState<Error | null>(null);
  const isRustAgentApi = api === "/agent/runs" || api.endsWith("/agent/runs");

  // The current assistant message being built (streaming in progress)
  const assistantMessageRef = useRef<StreamingMessage | null>(null);
  // Active reasoning text accumulated so far
  const reasoningTextRef = useRef<string>("");
  // Active tool calls by id — for updating in-place
  const toolCallsByIdRef = useRef<Map<string, ToolCallEvent>>(new Map());
  // Initial local placeholder shown before the first SSE frame arrives.
  const initialProgressPartIdRef = useRef<string | null>(null);
  // Abort controller for cancellation
  const abortRef = useRef<AbortController | null>(null);
  // Guard against double-start
  const streamingRef = useRef(false);

  function upsertAssistantMessage(
    prev: StreamingMessage[],
    message: StreamingMessage,
  ): StreamingMessage[] {
    const existingIndex = prev.findIndex((item) => item.id === message.id);
    if (existingIndex !== -1) {
      return [
        ...prev.slice(0, existingIndex),
        message,
        ...prev.slice(existingIndex + 1),
      ];
    }
    return [...prev, message];
  }

  // ---------------------------------------------------------------------------
  // Parse an SSE data line into our event format
  // ---------------------------------------------------------------------------
  function parseEvent(line: string): SSEEvent | null {
    if (!line.startsWith("data: ")) return null;
    const raw = line.slice(6).trim();
    if (!raw || raw === "[DONE]") return null;
    try {
      return JSON.parse(raw) as SSEEvent;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Append a new part to the current assistant message (or create it if absent)
  // ---------------------------------------------------------------------------
  function appendPart(part: StreamPart) {
    if (!assistantMessageRef.current) {
      assistantMessageRef.current = {
        id: nextId(),
        role: "assistant",
        orderedParts: [],
        isComplete: false,
        isStreaming: true,
      };
    }

    const placeholderId = initialProgressPartIdRef.current;
    if (placeholderId) {
      assistantMessageRef.current.orderedParts = assistantMessageRef.current.orderedParts.filter(
        (existing) => existing.id !== placeholderId,
      );
      initialProgressPartIdRef.current = null;
    }

    assistantMessageRef.current.orderedParts.push(part);

    // Keep tool calls index updated for in-place state transitions
    if (part.type.startsWith("tool-call")) {
      const t = part as ToolCallEvent;
      if (t.toolCallId) {
        toolCallsByIdRef.current.set(t.toolCallId, t);
      }
    }

    setMessages((prev) => upsertAssistantMessage(prev, assistantMessageRef.current!));
  }

  // ---------------------------------------------------------------------------
  // Update an existing tool call in-place (state transition)
  // ---------------------------------------------------------------------------
  function updateToolCall(
    toolCallId: string,
    partial: Partial<ToolCallEvent>
  ) {
    if (!assistantMessageRef.current) return;
    const parts = assistantMessageRef.current.orderedParts;
    const idx = parts.findIndex(
      (p) =>
        p.type.startsWith("tool-call") &&
        (p as ToolCallEvent).toolCallId === toolCallId
    );
    if (idx !== -1) {
      Object.assign(parts[idx], partial);
      // Update the index too
      if (partial.toolCallId) {
        toolCallsByIdRef.current.set(partial.toolCallId, parts[idx] as ToolCallEvent);
      }
      setMessages((prev) => {
        return upsertAssistantMessage(prev, { ...assistantMessageRef.current! });
      });
    } else if (partial.toolName || partial.args || partial.result || partial.errorText) {
      appendPart({
        id: nextId(),
        toolCallId,
        toolName: partial.toolName ?? "tool",
        type: partial.type ?? "tool-call-start",
        state: partial.state ?? "calling",
        args: partial.args,
        result: partial.result,
        errorText: partial.errorText,
        invocationMessage: partial.invocationMessage,
        pastTenseMessage: partial.pastTenseMessage,
        originMessage: partial.originMessage,
      } satisfies ToolCallEvent);
    }
  }

  // ---------------------------------------------------------------------------
  // Accumulate reasoning text as deltas arrive
  // ---------------------------------------------------------------------------
  function appendReasoningDelta(text: string) {
    reasoningTextRef.current += text;
    const part: ReasoningPartEvent = {
      id: nextId(),
      type: "reasoning-delta",
      text: reasoningTextRef.current,
    };
    // If the last part is also reasoning-delta, replace it (update in place)
    const parts = assistantMessageRef.current?.orderedParts ?? [];
    const lastReasoning = parts[parts.length - 1];
    if (lastReasoning?.type === "reasoning-delta") {
      Object.assign(lastReasoning, part);
      setMessages((prev) => {
        return assistantMessageRef.current
          ? upsertAssistantMessage(prev, { ...assistantMessageRef.current })
          : prev;
      });
    } else {
      appendPart(part);
    }
  }

  // ---------------------------------------------------------------------------
  // Handle a single parsed SSE event
  // ---------------------------------------------------------------------------
  function handleEvent(ev: SSEEvent) {
    switch (ev.type) {
      case "reasoning-start":
        reasoningTextRef.current = "";
        appendPart({
          id: ev.data.id ?? nextId(),
          type: "reasoning-start",
          text: "",
        } satisfies ReasoningPartEvent);
        break;

      case "reasoning-delta":
        appendReasoningDelta(ev.data.text ?? "");
        break;

      case "reasoning-end":
        appendPart({
          id: ev.data.id ?? nextId(),
          type: "reasoning-end",
          text: "",
        } satisfies ReasoningPartEvent);
        break;

      case "tool-call-start":
        appendPart({
          id: nextId(),
          toolCallId: ev.data.toolCallId ?? nextId(),
          toolName: ev.data.toolName ?? "tool",
          type: "tool-call-start",
          state: "calling",
          args: ev.data.args,
          invocationMessage: ev.data.invocationMessage,
          originMessage: ev.data.originMessage,
        } satisfies ToolCallEvent);
        break;

      case "tool-call-update":
        updateToolCall(ev.data.toolCallId ?? "", {
          invocationMessage: ev.data.invocationMessage,
          pastTenseMessage: ev.data.pastTenseMessage,
        });
        break;

      case "tool-call-input-streaming":
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-input-streaming",
          state: "input-streaming",
          args: { ...(ev.data.args ?? {}) },
        });
        break;

      case "tool-call-input-available":
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-input-available",
          state: "input-available",
          args: ev.data.args,
        });
        break;

      case "tool-call-execute":
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-execute",
          state: "executing",
        });
        break;

      case "tool-call-output-available":
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-output-available",
          state: "output-available",
          result: ev.data.result,
          pastTenseMessage: ev.data.pastTenseMessage,
        });
        break;

      case "tool-call-output-error":
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-output-error",
          state: "output-error",
          errorText: ev.data.errorText,
          result: ev.data.result,
        });
        break;

      case "tool-call-end":
        // End marks lifecycle completion but should not replace the visible
        // invocation part. The output/error state already carries the UI state.
        break;

      case "text-delta":
        appendPart({
          id: nextId(),
          type: "text-delta",
          text: ev.data.text ?? "",
        } satisfies TextDeltaEvent);
        break;

      case "text-end":
        appendPart({
          id: nextId(),
          type: "text-end",
          text: "",
        } satisfies TextDeltaEvent);
        break;

      case "source-url":
        appendPart({
          id: nextId(),
          type: "source-url",
          url: ev.data.url ?? "",
          title: ev.data.title,
        } satisfies SourceUrlEvent);
        break;

      case "progress":
        appendPart({
          id: nextId(),
          type: "progress",
          text: ev.data.text ?? "",
          status: ev.data.progressStatus ?? (ev.data.status === "complete" ? "complete" : ev.data.status === "active" ? "active" : ev.data.status === "success" ? "complete" : ev.data.status === "error" ? "error" : ev.data.status === "loading" ? "active" : undefined),
        } satisfies ProgressEvent);
        break;

      case "anchor":
        appendPart({
          id: nextId(),
          type: "anchor",
          uri: ev.data.uri ?? "",
          title: ev.data.title,
          line: ev.data.line,
        } satisfies AnchorEvent);
        break;

      case "reference":
        const referenceStatus = ev.data.status === "loading" || ev.data.status === "success" || ev.data.status === "error" || ev.data.status === "omitted" || ev.data.status === "partial"
          ? ev.data.status
          : undefined;
        appendPart({
          id: nextId(),
          type: "reference",
          uri: ev.data.uri ?? "",
          title: ev.data.title,
          status: referenceStatus,
        } satisfies ReferenceEvent);
        break;

      case "codeblock-uri":
        appendPart({
          id: nextId(),
          type: "codeblock-uri",
          uri: ev.data.uri ?? "",
          isEdit: ev.data.isEdit,
        } satisfies CodeblockUriEvent);
        break;

      case "text-edit":
        appendPart({
          id: nextId(),
          type: "text-edit",
          target: ev.data.target ?? "",
          edits: ev.data.edits,
          isDone: ev.data.isDone,
        } satisfies TextEditEvent);
        break;

      case "confirmation":
        appendPart({
          id: nextId(),
          type: "confirmation",
          confirmationId: ev.data.id ?? nextId(),
          title: ev.data.title ?? "",
          message: ev.data.message ?? "",
          data: ev.data.data,
          buttons: ev.data.buttons ?? ["OK"],
        } satisfies ConfirmationEvent);
        break;

      case "command-button":
        appendPart({
          id: nextId(),
          type: "command-button",
          command: ev.data.command ?? "",
          title: ev.data.title ?? "",
          args: ev.data.args,
        } satisfies CommandButtonEvent);
        break;

      case "subagent-start":
        appendPart({
          id: nextId(),
          type: "subagent-start",
          toolCallId: ev.data.toolCallId ?? nextId(),
          agentName: ev.data.agentName,
          prompt: ev.data.prompt,
          runId: ev.data.runId,
          logUrl: ev.data.logUrl,
        } satisfies SubagentEvent);
        break;

      case "subagent-progress":
        appendPart({
          id: nextId(),
          type: "subagent-progress",
          toolCallId: ev.data.toolCallId ?? nextId(),
          agentName: ev.data.agentName,
          text: ev.data.text,
          status: ev.data.subagentStatus ?? (ev.data.status === "complete" ? "complete" : ev.data.status === "error" ? "error" : "active"),
          runId: ev.data.runId,
          logUrl: ev.data.logUrl,
        } satisfies SubagentEvent);
        break;

      case "subagent-result":
        appendPart({
          id: nextId(),
          type: "subagent-result",
          toolCallId: ev.data.toolCallId ?? nextId(),
          agentName: ev.data.agentName,
          runId: ev.data.runId,
          logUrl: ev.data.logUrl,
          result: ev.data.result,
        } satisfies SubagentEvent);
        break;

      case "warning":
        appendPart({
          id: nextId(),
          type: "warning",
          text: ev.data.text ?? "",
        } satisfies WarningEvent);
        break;

      case "usage":
        appendPart({
          id: nextId(),
          type: "usage",
          promptTokens: ev.data.promptTokens ?? 0,
          completionTokens: ev.data.completionTokens ?? 0,
          totalTokens: ev.data.totalTokens ?? 0,
        } satisfies UsageEvent);
        break;

      case "error": {
        const e = new Error(ev.data.errorText ?? "Unknown error");
        setError(e);
        setStatus("error");
        break;
      }

      case "message-end":
        if (assistantMessageRef.current) {
          assistantMessageRef.current.isComplete = true;
          assistantMessageRef.current.isStreaming = false;
          setMessages((prev) => {
            return upsertAssistantMessage(prev, assistantMessageRef.current!);
          });
          onFinished?.(assistantMessageRef.current);
        }
        // Flip top-level status immediately so the input re-enables even if
        // the backend keeps the SSE channel open (keepalive pings).
        streamingRef.current = false;
        setStatus("idle");
        break;

      // Synthetic terminal frame from the backend (sent after the live
      // broadcast has emitted a terminal event). Mirrors `message-end`.
      case "done":
      case "run-completed":
      case "run-failed":
      case "run-cancelled":
        if (assistantMessageRef.current) {
          assistantMessageRef.current.isComplete = true;
          assistantMessageRef.current.isStreaming = false;
          setMessages((prev) => upsertAssistantMessage(prev, assistantMessageRef.current!));
        }
        streamingRef.current = false;
        setStatus("idle");
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // sendMessage — fires a POST and processes the SSE stream
  // ---------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (
      text: string,
      opts?: {
        conversationId?: string | null;
        modelSpec?: string | null;
        reasoningLevel?: string;
        channel?: string;
      }
    ) => {
      if (streamingRef.current) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Reset state for new message
      streamingRef.current = true;
      setError(null);
      assistantMessageRef.current = null;
      reasoningTextRef.current = "";
      toolCallsByIdRef.current.clear();
      initialProgressPartIdRef.current = null;
      setStatus("submitted");

      // Append user message immediately, plus an empty assistant placeholder
      // so the StreamingAssistantMessage's built-in "Working…" indicator can
      // render alone (no duplicate progress row).
      const userMsg: StreamingMessage = {
        id: nextId(),
        role: "user",
        orderedParts: [{ id: nextId(), type: "text-delta", text } satisfies TextDeltaEvent],
        isComplete: true,
        isStreaming: false,
      };
      assistantMessageRef.current = {
        id: nextId(),
        role: "assistant",
        orderedParts: [],
        isComplete: false,
        isStreaming: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMessageRef.current!]);

      try {
        const res = isRustAgentApi
          ? await (async () => {
              const createRes = await operonFetch("/agent/runs", {
                method: "POST",
                body: JSON.stringify({
                  prompt: text,
                  conversation_id: opts?.conversationId ?? conversationId ?? null,
                  model: opts?.modelSpec,
                  reasoning_level: opts?.reasoningLevel,
                  channel: opts?.channel,
                }),
                signal: abortRef.current?.signal,
              });
              if (!createRes.ok) return createRes;
              const created = (await createRes.json()) as {
                run_id: string;
                conversation_id: string;
              };
              const streamRes = await operonFetch(`/agent/runs/${created.run_id}/sse`, {
                headers: { Accept: "text/event-stream" },
                signal: abortRef.current?.signal,
              });
              return new Response(streamRes.body, {
                status: streamRes.status,
                statusText: streamRes.statusText,
                headers: {
                  "Content-Type": streamRes.headers.get("content-type") ?? "text/event-stream",
                  "X-Run-Id": created.run_id,
                  "X-Conversation-Id": created.conversation_id,
                },
              });
            })()
          : await fetch(api, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", parts: [{ type: "text", text }] }],
                conversationId: opts?.conversationId ?? conversationId ?? null,
                modelSpec: opts?.modelSpec,
                reasoningLevel: opts?.reasoningLevel,
                channel: opts?.channel,
              }),
              signal: abortRef.current.signal,
            });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        if (!res.body) {
          throw new Error("Response body is null");
        }

        try { onResponse?.(res); } catch { /* ignore observer errors */ }

        setStatus("streaming");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // Read the stream chunk by chunk
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on newlines — each line is a separate SSE data line
          const lines = buffer.split("\n");
          // Keep the last partial line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const ev = parseEvent(line);
            if (ev) handleEvent(ev);
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const ev = parseEvent(buffer);
          if (ev) handleEvent(ev);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // User cancelled — not an error
        } else {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          setStatus("error");
        }
      } finally {
        streamingRef.current = false;
        setStatus((s) => (s === "streaming" ? "idle" : s));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleEvent is defined in hook body and captures only stable refs
    [api, conversationId, isRustAgentApi, onFinished, onResponse]
  );

  // ---------------------------------------------------------------------------
  // stop — abort the in-flight request
  // ---------------------------------------------------------------------------
  const stop = useCallback(() => {
    abortRef.current?.abort();
    if (assistantMessageRef.current) {
      assistantMessageRef.current.isComplete = true;
      assistantMessageRef.current.isStreaming = false;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return [...prev.slice(0, -1), { ...assistantMessageRef.current! }];
        }
        return prev;
      });
    }
    streamingRef.current = false;
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { messages, sendMessage, stop, status, error, setMessages };
}
