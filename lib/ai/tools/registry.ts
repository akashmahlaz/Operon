import type { Tool } from "ai";
import { createGitHubTools } from "@/lib/ai/tools/github";
import { createMemoryTools } from "@/lib/ai/tools/memory";
import { getMcpTools } from "@/lib/ai/mcp-client";
import { getAuthProfile } from "@/lib/services/auth-profiles";

export type ToolCategory = "memory" | "github" | "google" | "social" | "trading" | "coding" | "system";

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
  build: (userId: string) => Record<string, Tool>;
}

const REGISTRY: ToolDescriptor[] = [
  {
    name: "memory",
    category: "memory",
    description: "Long-term memory: remember and recall stable preferences and facts.",
    build: (userId) => createMemoryTools(userId) as Record<string, Tool>,
  },
  {
    name: "github",
    category: "github",
    description: "GitHub: save token, list/read/search repos, create repos, write files. Always exposed so the agent can capture a token mid-conversation; read/write tools return a clear error if no token is configured yet.",
    build: (userId) => createGitHubTools(userId) as Record<string, Tool>,
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

export async function buildAvailableTools(userId: string): Promise<Record<string, Tool>> {
  const statuses = await getToolStatuses(userId);
  const available = new Set(statuses.filter((status) => status.available).map((status) => status.name));
  const tools: Record<string, Tool> = {};
  for (const descriptor of REGISTRY) {
    if (!available.has(descriptor.name)) continue;
    Object.assign(tools, descriptor.build(userId));
  }
  // Add MCP tools from user-configured servers (dynamically resolved each turn)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mcpTools = await getMcpTools(userId).catch(() => ({} as Record<string, Tool<any, any>>));
  Object.assign(tools, mcpTools);
  return tools;
}
