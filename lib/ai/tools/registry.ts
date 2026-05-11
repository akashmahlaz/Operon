import type { Tool } from "ai";
import { createGitHubTools } from "@/lib/ai/tools/github";
import { createMemoryTools } from "@/lib/ai/tools/memory";
import { createAgentSkillTools } from "@/lib/ai/tools/agent-skills";
import { createWorkspaceFileTools } from "@/lib/ai/tools/workspace-file";
import { createCodingTools } from "@/lib/ai/tools/coding";
import { createVercelTools } from "@/lib/ai/tools/vercel";
import { createGmailTools } from "@/lib/ai/tools/gmail";
import { createMetaAdsTools } from "@/lib/ai/tools/meta-ads";
import { createCloudflareTools } from "@/lib/ai/tools/cloudflare";
import { createStripeTools } from "@/lib/ai/tools/stripe";
import { createSeoTools } from "@/lib/ai/tools/seo";
import { createConfirmTools } from "@/lib/ai/tools/confirm";
import { createCalendarTools } from "@/lib/ai/tools/calendar";
import { createLinearTools } from "@/lib/ai/tools/linear";
import { createSlackTools } from "@/lib/ai/tools/slack";
import { createNotionTools } from "@/lib/ai/tools/notion";
import { createResendTools } from "@/lib/ai/tools/resend";
import { createTwilioTools } from "@/lib/ai/tools/twilio";
import { createDiscordTools } from "@/lib/ai/tools/discord";
import { getMcpTools } from "@/lib/ai/mcp-client";
import { getAuthProfile } from "@/lib/services/auth-profiles";

export type ToolCategory = "memory" | "skills" | "github" | "google" | "social" | "trading" | "coding" | "seo" | "payments" | "infra" | "system" | "productivity" | "email";

export interface ToolRequirement {
  /** Provider id (matches auth profile provider). */
  provider: string;
  /** Optional human label used in UI. */
  label?: string;
  /** Where the user can connect this provider. */
  connectHref?: string;
}

export interface ToolDescriptor {
  name: string;
  category: ToolCategory;
  /** Short user-facing description. */
  description: string;
  /** Requirements that must be satisfied for the tool to be available. */
  requires?: ToolRequirement[];
  /** When set, this descriptor is only included for matching channels. */
  channels?: string[];
  build: (userId: string, context: ToolBuildContext) => Record<string, Tool>;
}

export interface ToolBuildContext {
  channel: string;
  conversationId: string | null;
}

const REGISTRY: ToolDescriptor[] = [
  {
    name: "confirm",
    category: "system",
    description: "Two-phase confirmation tool. Call confirm_action(token, approve) ONLY after the operator has explicitly approved the action's summary; then re-issue the original destructive tool call with __confirmToken set.",
    build: (userId) => createConfirmTools(userId) as Record<string, Tool>,
  },
  {
    name: "memory",
    category: "memory",
    description: "Long-term memory: remember and recall stable preferences and facts.",
    build: (userId) => createMemoryTools(userId) as Record<string, Tool>,
  },
  {
    name: "agent_skills",
    category: "skills",
    description:
      "Procedural memory: recall, save, and run multi-step recipes (Hermes-style). Always recall before planning a multi-step workflow.",
    build: (userId) => createAgentSkillTools(userId) as Record<string, Tool>,
  },
  {
    name: "workspace_files",
    category: "memory",
    description: "Read and write workspace files (BOOTSTRAP.md / SOUL.md / USER.md). Use workspace_file_write to build the operator's permanent profile.",
    build: (userId) => createWorkspaceFileTools(userId) as Record<string, Tool>,
  },
  {
    name: "github",
    category: "github",
    description: "GitHub: save token, list/read/search repos, create repos, write files. Always exposed so the agent can capture a token mid-conversation; read/write tools return a clear error if no token is configured yet.",
    build: (userId) => createGitHubTools(userId) as Record<string, Tool>,
  },
  {
    name: "vercel",
    category: "coding",
    description: "Vercel: save token, list teams/projects/deployments/domains, fetch deployment logs, and manage environment variables. Always exposed; per-call errors describe missing token state.",
    build: (userId) => createVercelTools(userId) as Record<string, Tool>,
  },
  {
    name: "gmail",
    category: "google",
    description: "Gmail: save Google OAuth token, search/read/send/draft/reply/label messages. Always exposed so the agent can capture a token mid-conversation.",
    build: (userId) => createGmailTools(userId) as Record<string, Tool>,
  },
  {
    name: "meta_ads",
    category: "social",
    description: "Meta Ads (Facebook/Instagram): save token, list ad accounts/campaigns, fetch insights, pause/resume campaigns.",
    build: (userId) => createMetaAdsTools(userId) as Record<string, Tool>,
  },
  {
    name: "cloudflare",
    category: "infra",
    description: "Cloudflare: save token, list zones/accounts, manage DNS records, purge cache, list Workers and R2 buckets.",
    build: (userId) => createCloudflareTools(userId) as Record<string, Tool>,
  },
  {
    name: "stripe",
    category: "payments",
    description: "Stripe: save key, list/create products and prices, create checkout sessions and payment links, list customers/payments, refund.",
    build: (userId) => createStripeTools(userId) as Record<string, Tool>,
  },
  {
    name: "seo",
    category: "seo",
    description: "SEO: Google Search Console (sites, search analytics, URL inspect, sitemaps) + PageSpeed Insights / Core Web Vitals. Uses the connected Google OAuth token.",
    build: (userId) => createSeoTools(userId) as Record<string, Tool>,
  },
  {
    name: "calendar",
    category: "google",
    description: "Google Calendar: list calendars/events, create/update/delete events, freeBusy lookup. Uses the connected Google OAuth token.",
    build: (userId) => createCalendarTools(userId) as Record<string, Tool>,
  },
  {
    name: "linear",
    category: "productivity",
    description: "Linear: save key, list teams/issues/projects, create/update issues, post comments.",
    build: (userId) => createLinearTools(userId) as Record<string, Tool>,
  },
  {
    name: "slack",
    category: "social",
    description: "Slack: save bot token, list channels, post messages, read history, search messages.",
    build: (userId) => createSlackTools(userId) as Record<string, Tool>,
  },
  {
    name: "notion",
    category: "productivity",
    description: "Notion: save token, search workspace, query databases, create/update pages, append blocks.",
    build: (userId) => createNotionTools(userId) as Record<string, Tool>,
  },
  {
    name: "resend",
    category: "email",
    description: "Resend: save API key, send transactional emails, list/create domains.",
    build: (userId) => createResendTools(userId) as Record<string, Tool>,
  },
  {
    name: "twilio",
    category: "social",
    description: "Twilio: save AccountSid+AuthToken, send SMS, list recent messages.",
    build: (userId) => createTwilioTools(userId) as Record<string, Tool>,
  },
  {
    name: "discord",
    category: "social",
    description: "Discord (bot): save token, list guilds/channels, send messages, read channel history.",
    build: (userId) => createDiscordTools(userId) as Record<string, Tool>,
  },
  {
    name: "coding",
    category: "coding",
    description:
      "Coding-session tools (file read/write, unified-diff patches, shell exec, search, plan management). Operates in a per-conversation workspace under ./workspaces/<conversationId>/.",
    channels: ["coding"],
    build: (userId, ctx) => createCodingTools(userId, ctx.conversationId) as Record<string, Tool>,
  },
];

export function listToolDescriptors(): ToolDescriptor[] {
  return REGISTRY;
}

async function isRequirementMet(userId: string, requirement: ToolRequirement) {
  const profile = await getAuthProfile(userId, requirement.provider);
  return Boolean(profile);
}

export async function getToolStatuses(userId: string) {
  return Promise.all(
    REGISTRY.map(async (descriptor) => {
      const requirements = descriptor.requires ?? [];
      const checks = await Promise.all(
        requirements.map(async (requirement) => ({
          provider: requirement.provider,
          label: requirement.label ?? requirement.provider,
          connectHref: requirement.connectHref,
          satisfied: await isRequirementMet(userId, requirement),
        })),
      );
      const available = checks.every((check) => check.satisfied);
      return {
        name: descriptor.name,
        category: descriptor.category,
        description: descriptor.description,
        available,
        requirements: checks,
      };
    }),
  );
}

export async function buildAvailableTools(
  userId: string,
  context: ToolBuildContext = { channel: "web", conversationId: null },
): Promise<Record<string, Tool>> {
  const statuses = await getToolStatuses(userId);
  const available = new Set(statuses.filter((status) => status.available).map((status) => status.name));
  const tools: Record<string, Tool> = {};
  for (const descriptor of REGISTRY) {
    if (!available.has(descriptor.name)) continue;
    if (descriptor.channels && !descriptor.channels.includes(context.channel)) continue;
    Object.assign(tools, descriptor.build(userId, context));
  }
  // Add MCP tools from user-configured servers (dynamically resolved each turn)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpTools = await getMcpTools(userId).catch(() => ({} as Record<string, Tool<any, any>>));
  Object.assign(tools, mcpTools);
  return tools;
}
