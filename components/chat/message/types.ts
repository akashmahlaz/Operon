export interface ToolCallPart {
  type: "tool-invocation";
  toolName: string;
  state: "calling" | "result" | "error" | "input-streaming" | "input-available" | "executing" | "output-available" | "output-error";
  args?: Record<string, unknown>;
  result?: unknown;
  errorText?: string;
  invocationMessage?: string;
  pastTenseMessage?: string;
}

export interface ChatDisplayMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: ToolCallPart[];
  thinking?: string;
  createdAt?: string;
}

export interface ParsedAttachment {
  type: "image" | "file";
  name: string;
  url: string;
}
