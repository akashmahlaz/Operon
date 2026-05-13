"use client";

// Individual streaming content part events
// These represent in-order events as they arrive from the SSE stream
//
// Vocabulary mirrors VS Code's ChatResponseStream
// (vscode-copilot-chat/src/util/common/chatResponseStreamImpl.ts).

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
  | "source-url"
  | "progress"
  | "anchor"
  | "reference"
  | "codeblock-uri"
  | "text-edit"
  | "confirmation"
  | "command-button"
  | "subagent-start"
  | "subagent-progress"
  | "subagent-result"
  | "warning"
  | "usage"
  | "provider-request-id"
  | "stream-error";

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
  /** Present-tense status shown while running. */
  invocationMessage?: string;
  /** Past-tense status shown after completion ("Read file `foo.ts`"). */
  pastTenseMessage?: string;
  /** Optional initiator label (e.g. tool group). */
  originMessage?: string;
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

/** Inline status line. */
export interface ProgressEvent {
  id: string;
  type: "progress";
  text: string;
  status?: "active" | "complete" | "error";
}

/** Subagent lifecycle rows, modelled after VS Code's runSubagent tool data. */
export interface SubagentEvent {
  id: string;
  type: "subagent-start" | "subagent-progress" | "subagent-result";
  toolCallId: string;
  agentName?: string;
  prompt?: string;
  text?: string;
  status?: "active" | "complete" | "error";
  runId?: string;
  logUrl?: string;
  result?: unknown;
}

/** Inline clickable file/symbol anchor. */
export interface AnchorEvent {
  id: string;
  type: "anchor";
  uri: string;
  title?: string;
  line?: number;
}

/** Sidebar reference chip with a status. */
export interface ReferenceEvent {
  id: string;
  type: "reference";
  uri: string;
  title?: string;
  status?: "loading" | "success" | "error" | "omitted" | "partial";
}

/** Associate the next ``` block with a file. */
export interface CodeblockUriEvent {
  id: string;
  type: "codeblock-uri";
  uri: string;
  isEdit?: boolean;
}

/** Streaming edit chunk for a file. */
export interface TextEditEvent {
  id: string;
  type: "text-edit";
  target: string;
  edits: unknown;
  isDone?: boolean;
}

/** Confirmation card (Yes/No or custom buttons). */
export interface ConfirmationEvent {
  id: string;
  type: "confirmation";
  confirmationId: string;
  title: string;
  message: string;
  data: unknown;
  buttons: string[];
  /** Filled in when the user picks a button. */
  resolution?: string;
}

/** Inline command button. */
export interface CommandButtonEvent {
  id: string;
  type: "command-button";
  command: string;
  title: string;
  args: unknown;
}

/** Warning banner inside the assistant response. */
export interface WarningEvent {
  id: string;
  type: "warning";
  text: string;
}

/** Token usage emitted on completion. */
export interface UsageEvent {
  id: string;
  type: "usage";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Provider-side request id captured from response headers. */
export interface ProviderRequestIdEvent {
  id: string;
  type: "provider-request-id";
  provider: string;
  model: string;
  requestId: string;
}

/** Stream-level error rendered as an inline error card. */
export interface StreamErrorEvent {
  id: string;
  type: "stream-error";
  message: string;
  requestId?: string | null;
  provider?: string | null;
}

// A single ordered part in the stream
export type StreamPart =
  | ReasoningPartEvent
  | ToolCallEvent
  | TextDeltaEvent
  | SourceUrlEvent
  | ProgressEvent
  | AnchorEvent
  | ReferenceEvent
  | CodeblockUriEvent
  | TextEditEvent
  | ConfirmationEvent
  | CommandButtonEvent
  | SubagentEvent
  | WarningEvent
  | UsageEvent
  | ProviderRequestIdEvent
  | StreamErrorEvent;

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
  invocationMessage?: string;
  pastTenseMessage?: string;
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
  errorText?: string;
  invocationMessage?: string;
  pastTenseMessage?: string;
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
