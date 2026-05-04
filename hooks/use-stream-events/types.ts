"use client";

// Individual streaming content part events
// These represent in-order events as they arrive from the SSE stream

export type ContentPartType =
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
  | "source-url";

export interface ReasoningPartEvent {
  id: string;
  type: "reasoning-start" | "reasoning-delta" | "reasoning-end";
  text: string;
}

export interface ToolCallEvent {
  id: string;
  toolCallId: string;
  toolName: string;
  type: ContentPartType;
  args?: Record<string, unknown>;
  result?: unknown;
  errorText?: string;
  state:
    | "calling"
    | "input-streaming"
    | "input-available"
    | "executing"
    | "output-available"
    | "output-error";
}

export interface TextDeltaEvent {
  id: string;
  type: "text-delta" | "text-end";
  text: string;
}

export interface SourceUrlEvent {
  id: string;
  type: "source-url";
  url: string;
  title?: string;
}

// A single ordered part in the stream
export type StreamPart =
  | ReasoningPartEvent
  | ToolCallEvent
  | TextDeltaEvent
  | SourceUrlEvent;

// Full ordered list for a message being built
export interface StreamingMessage {
  id: string;
  role: "user" | "assistant";
  orderedParts: StreamPart[];
  isComplete: boolean;
  isStreaming: boolean;
}

// For mapping from AI SDK UIMessage to our streaming format
export interface UIMessagePart {
  type: string;
  text?: string;
  reasoning?: string;
  toolCallId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  state?: string;
  url?: string;
  title?: string;
}

// Re-export tool call part for compatibility
export interface ToolCallPart {
  type: "tool-invocation";
  toolName: string;
  state:
    | "calling"
    | "input-streaming"
    | "input-available"
    | "executing"
    | "output-available"
    | "output-error";
  args?: Record<string, unknown>;
  result?: unknown;
}

// Tool state helpers
export function getToolLabel(toolName: string): string {
  if (!toolName) return "Tool";
  // Strip namespace prefix if present (e.g. "github_searchRepositories" -> "searchRepositories")
  const label = toolName.includes("_") ? toolName.split("_").slice(1).join("_") : toolName;
  // Convert camelCase/PascalCase to space-separated words
  return label
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, " ")
    .trim();
}

export const TOOL_STATE_LABELS: Record<ToolCallEvent["state"], string> = {
  calling: "Working",
  "input-streaming": "Preparing",
  "input-available": "Calling",
  executing: "Running",
  "output-available": "Done",
  "output-error": "Error",
};

export function isToolState(state: string): state is ToolCallEvent["state"] {
  return [
    "calling",
    "input-streaming",
    "input-available",
    "executing",
    "output-available",
    "output-error",
  ].includes(state);
}