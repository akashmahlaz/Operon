/**
 * Domain types shared across the app.
 * Keep narrow, serializable, and free of runtime imports so they can be
 * imported from server actions, route handlers, and client components alike.
 */

export type Channel = "web" | "whatsapp" | "telegram";

export interface ConversationSummary {
  id: string;
  title: string;
  channel: Channel;
  preview?: string;
  messageCount: number;
  updatedAt: string; // ISO
}

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  // We persist the full v6 UIMessage `parts` payload so tool-calls / reasoning
  // can be re-hydrated on reload.
  parts: unknown[];
  createdAt: string;
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
