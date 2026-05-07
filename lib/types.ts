/**
 * Domain types shared across the app.
 * Keep narrow, serializable, and free of runtime imports so they can be
 * imported from server actions, route handlers, and client components alike.
 */

export type Channel = "web" | "whatsapp" | "telegram" | "coding";

export interface ConversationSummary {
  id: string;
  _id?: string;
  title: string;
  channel: Channel;
  preview?: string;
  lastMessage?: string | null;
  messageCount: number;
  createdAt?: string;
  updatedAt: string; // ISO
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  _id?: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  // We persist the full v6 UIMessage `parts` payload so tool-calls / reasoning
  // can be re-hydrated on reload.
  parts: unknown[];
  createdAt: string;
}

export interface ConversationDetail {
  _id: string;
  title: string;
  channel: Channel;
  lastMessage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  userId: string;
  messages: ChatMessage[];
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "automation" | "creative" | "data" | "communication" | "developer";
  enabled: boolean;
  installed: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[]; // skill slugs
  enabled: boolean;
  createdAt: string;
}

export interface Integration {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: "productivity" | "social" | "developer" | "finance" | "messaging";
  connected: boolean;
}

export interface ScheduledJob {
  id: string;
  description: string;
  cron: string;
  lastRunAt?: string;
  nextRunAt?: string;
  status: "active" | "paused" | "errored";
}

export interface LogEntry {
  id: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  createdAt: string;
}
