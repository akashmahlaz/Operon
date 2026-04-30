import type { Integration } from "@/lib/types";

export const builtInIntegrations: Integration[] = [
  { id: "google", slug: "google", name: "Google Workspace", description: "Gmail, Calendar, Drive, Docs.", category: "productivity", connected: false },
  { id: "ms365", slug: "microsoft365", name: "Microsoft 365", description: "Outlook, Teams, OneDrive.", category: "productivity", connected: false },
  { id: "slack", slug: "slack", name: "Slack", description: "Send and read Slack messages.", category: "messaging", connected: false },
  { id: "whatsapp", slug: "whatsapp", name: "WhatsApp", description: "Linked device via Baileys.", category: "messaging", connected: false },
  { id: "telegram", slug: "telegram", name: "Telegram", description: "Bot API integration.", category: "messaging", connected: false },
  { id: "github", slug: "github", name: "GitHub", description: "Issues, PRs, code search.", category: "developer", connected: false },
  { id: "stripe", slug: "stripe", name: "Stripe", description: "Payments and subscriptions.", category: "finance", connected: false },
  { id: "x", slug: "x", name: "X / Twitter", description: "Post and read.", category: "social", connected: false },
];
