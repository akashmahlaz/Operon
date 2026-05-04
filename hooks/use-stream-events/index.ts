"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type {
  StreamingMessage,
  StreamPart,
  ReasoningPartEvent,
  ToolCallEvent,
  TextDeltaEvent,
  SourceUrlEvent,
} from "./types";

// ---------------------------------------------------------------------------
// SSE event shape emitted by /api/chat
// The server sends custom NDJSON events prefixed with "event: " lines.
// ---------------------------------------------------------------------------

type SSEEventType =
  | "reasoning-start"
  | "reasoning-delta"
  | "reasoning-end"
  | "tool-call-start"
  | "tool-call-input-streaming"
  | "tool-call-input-available"
  | "tool-call-execute"
  | "tool-call-output-available"
  | "tool-call-output-error"
  | "tool-call-end"
  | "text-delta"
  | "text-end"
  | "source-url"
  | "message-end";

interface SSEEvent {
  type: SSEEventType;
  data: {
    id?: string;
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    result?: unknown;
    errorText?: string;
    url?: string;
    title?: string;
  };
}

// ---------------------------------------------------------------------------
// Custom useChat — replaces @ai-sdk/react useChat for streaming events
// ---------------------------------------------------------------------------

interface UseStreamEventsOptions {
  api: string;
  conversationId?: string | null;
  onFinished?: (message: StreamingMessage) => void;
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
  return `part-${++_partIdCounter}-${Date.now()}`;
}

export function useStreamEvents({
  api,
  conversationId,
  onFinished,
}: UseStreamEventsOptions): UseStreamEventsReturn {
  const [messages, setMessages] = useState<StreamingMessage[]>([]);
  const [status, setStatus] = useState<
    "idle" | "submitted" | "streaming" | "error"
  >("idle");
  const [error, setError] = useState<Error | null>(null);

  // The current assistant message being built (streaming in progress)
  const assistantMessageRef = useRef<StreamingMessage | null>(null);
  // Active reasoning text accumulated so far
  const reasoningTextRef = useRef<string>("");
  // Active tool calls by id — for updating in-place
  const toolCallsByIdRef = useRef<Map<string, ToolCallEvent>>(new Map());
  // Abort controller for cancellation
  const abortRef = useRef<AbortController | null>(null);
  // Guard against double-start
  const streamingRef = useRef(false);

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
    assistantMessageRef.current.orderedParts.push(part);

    // Keep tool calls index updated for in-place state transitions
    if (part.type.startsWith("tool-call")) {
      const t = part as ToolCallEvent;
      if (t.toolCallId) {
        toolCallsByIdRef.current.set(t.toolCallId, t);
      }
    }

    setMessages((prev) => {
      // Replace the last assistant message with the updated one
      // (or append if this is the first)
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && !last.isComplete) {
        return [...prev.slice(0, -1), assistantMessageRef.current!];
      }
      return [...prev, assistantMessageRef.current!];
    });
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
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.isComplete) {
          return [...prev.slice(0, -1), { ...assistantMessageRef.current! }];
        }
        return prev;
      });
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
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.isComplete) {
          return [...prev.slice(0, -1), { ...assistantMessageRef.current! }];
        }
        return prev;
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
          id: nextId(),
          type: "reasoning-start",
          text: "",
        } satisfies ReasoningPartEvent);
        break;

      case "reasoning-delta":
        appendReasoningDelta(ev.data.text ?? "");
        break;

      case "reasoning-end":
        appendPart({
          id: nextId(),
          type: "reasoning-end",
          text: reasoningTextRef.current,
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
        } satisfies ToolCallEvent);
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
        updateToolCall(ev.data.toolCallId ?? "", {
          type: "tool-call-end",
        });
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

      case "message-end":
        if (assistantMessageRef.current) {
          assistantMessageRef.current.isComplete = true;
          assistantMessageRef.current.isStreaming = false;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), assistantMessageRef.current!];
            }
            return prev;
          });
          onFinished?.(assistantMessageRef.current);
        }
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
      setStatus("submitted");

      // Append user message immediately
      const userMsg: StreamingMessage = {
        id: nextId(),
        role: "user",
        orderedParts: [{ id: nextId(), type: "text-delta", text } satisfies TextDeltaEvent],
        isComplete: true,
        isStreaming: false,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch(api, {
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
    [api, conversationId, onFinished]
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
