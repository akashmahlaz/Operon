import type { ContentPartType, StreamPart, ToolCallEvent } from "@/hooks/use-stream-events/types";
import { isToolState } from "@/hooks/use-stream-events/types";

const STREAM_PART_TYPES = new Set<ContentPartType>([
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

/**
 * Hydrate persisted UIMessage `parts` from MongoDB back into StreamPart[]
 * shapes that the streaming renderer understands. Used when reloading a
 * past conversation in the chat / coding views.
 */
export function hydrateMessageParts(
  messageId: string,
  parts: unknown[] | undefined,
  fallbackText: string,
): StreamPart[] {
  if (!Array.isArray(parts) || parts.length === 0) {
    return [{ id: `${messageId}-0`, type: "text-delta", text: fallbackText }];
  }

  const hydrated = parts.flatMap((part, index): StreamPart[] => {
    if (!part || typeof part !== "object") return [];
    const raw = part as Record<string, unknown>;
    const type = typeof raw.type === "string" ? raw.type : "";
    const id = typeof raw.id === "string" ? raw.id : `${messageId}-${index}`;

    if (STREAM_PART_TYPES.has(type as ContentPartType)) {
      if (type.startsWith("reasoning")) {
        return [{
          id,
          type: type as "reasoning-start" | "reasoning-delta" | "reasoning-end",
          text: typeof raw.text === "string" ? raw.text : "",
        }];
      }
      if (type.startsWith("tool-call")) {
        const state = typeof raw.state === "string" && isToolState(raw.state) ? raw.state : "output-available";
        return [{
          id,
          type: type as ToolCallEvent["type"],
          toolCallId: typeof raw.toolCallId === "string" ? raw.toolCallId : id,
          toolName: typeof raw.toolName === "string" ? raw.toolName : "tool",
          state,
          args: raw.args && typeof raw.args === "object" ? (raw.args as Record<string, unknown>) : undefined,
          result: raw.result,
          errorText: typeof raw.errorText === "string" ? raw.errorText : undefined,
        }];
      }
      if (type === "source-url") {
        return [{
          id,
          type: "source-url",
          url: typeof raw.url === "string" ? raw.url : "",
          title: typeof raw.title === "string" ? raw.title : undefined,
        }];
      }
      return [{
        id,
        type: type as "text-delta" | "text-end",
        text: typeof raw.text === "string" ? raw.text : "",
      }];
    }

    if (type === "text") {
      return [{ id, type: "text-delta", text: typeof raw.text === "string" ? raw.text : "" }];
    }
    if (type === "reasoning") {
      return [{
        id,
        type: "reasoning-delta",
        text: typeof raw.text === "string" ? raw.text : typeof raw.reasoning === "string" ? raw.reasoning : "",
      }];
    }
    return [];
  });

  return hydrated.length > 0
    ? hydrated
    : [{ id: `${messageId}-0`, type: "text-delta", text: fallbackText }];
}
