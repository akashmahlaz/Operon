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
  "progress",
  "anchor",
  "reference",
  "codeblock-uri",
  "text-edit",
  "confirmation",
  "command-button",
  "subagent-start",
  "subagent-progress",
  "subagent-result",
  "warning",
  "usage",
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
          invocationMessage: typeof raw.invocationMessage === "string" ? raw.invocationMessage : undefined,
          pastTenseMessage: typeof raw.pastTenseMessage === "string" ? raw.pastTenseMessage : undefined,
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
      if (type === "progress") {
        const status = typeof raw.status === "string" ? raw.status : undefined;
        return [{
          id,
          type: "progress",
          text: typeof raw.text === "string" ? raw.text : "",
          status: status === "active" || status === "complete" || status === "error" ? status : undefined,
        }];
      }
      if (type === "anchor") {
        return [{
          id,
          type: "anchor",
          uri: typeof raw.uri === "string" ? raw.uri : "",
          title: typeof raw.title === "string" ? raw.title : undefined,
          line: typeof raw.line === "number" ? raw.line : undefined,
        }];
      }
      if (type === "reference") {
        const status = typeof raw.status === "string" ? raw.status : undefined;
        return [{
          id,
          type: "reference",
          uri: typeof raw.uri === "string" ? raw.uri : "",
          title: typeof raw.title === "string" ? raw.title : undefined,
          status: status === "loading" || status === "success" || status === "error" || status === "omitted" || status === "partial" ? status : undefined,
        }];
      }
      if (type === "codeblock-uri") {
        return [{
          id,
          type: "codeblock-uri",
          uri: typeof raw.uri === "string" ? raw.uri : "",
          isEdit: typeof raw.isEdit === "boolean" ? raw.isEdit : undefined,
        }];
      }
      if (type === "text-edit") {
        return [{
          id,
          type: "text-edit",
          target: typeof raw.target === "string" ? raw.target : "",
          edits: raw.edits,
          isDone: typeof raw.isDone === "boolean" ? raw.isDone : undefined,
        }];
      }
      if (type === "confirmation") {
        return [{
          id,
          type: "confirmation",
          confirmationId: typeof raw.confirmationId === "string" ? raw.confirmationId : id,
          title: typeof raw.title === "string" ? raw.title : "",
          message: typeof raw.message === "string" ? raw.message : "",
          data: raw.data,
          buttons: Array.isArray(raw.buttons) ? raw.buttons.filter((button): button is string => typeof button === "string") : ["OK"],
          resolution: typeof raw.resolution === "string" ? raw.resolution : undefined,
        }];
      }
      if (type === "command-button") {
        return [{
          id,
          type: "command-button",
          command: typeof raw.command === "string" ? raw.command : "",
          title: typeof raw.title === "string" ? raw.title : "",
          args: raw.args,
        }];
      }
      if (type === "subagent-start" || type === "subagent-progress" || type === "subagent-result") {
        const status = typeof raw.status === "string" ? raw.status : undefined;
        return [{
          id,
          type: type as "subagent-start" | "subagent-progress" | "subagent-result",
          toolCallId: typeof raw.toolCallId === "string" ? raw.toolCallId : id,
          agentName: typeof raw.agentName === "string" ? raw.agentName : undefined,
          prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
          text: typeof raw.text === "string" ? raw.text : undefined,
          status: status === "active" || status === "complete" || status === "error" ? status : undefined,
          result: raw.result,
        }];
      }
      if (type === "warning") {
        return [{ id, type: "warning", text: typeof raw.text === "string" ? raw.text : "" }];
      }
      if (type === "usage") {
        return [{
          id,
          type: "usage",
          promptTokens: typeof raw.promptTokens === "number" ? raw.promptTokens : 0,
          completionTokens: typeof raw.completionTokens === "number" ? raw.completionTokens : 0,
          totalTokens: typeof raw.totalTokens === "number" ? raw.totalTokens : 0,
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
