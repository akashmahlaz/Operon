import type { Skill } from "@/lib/types";

/**
 * Built-in skill catalog. Persisted skills override these by slug.
 */
export const builtInSkills: Skill[] = [
  {
    id: "web-search",
    slug: "web_search",
    name: "Web search",
    description: "Search the live web and summarise results.",
    category: "data",
    enabled: true,
    installed: true,
  },
  {
    id: "image-gen",
    slug: "generate_image",
    name: "Image generation",
    description: "Create images from a text prompt.",
    category: "creative",
    enabled: true,
    installed: true,
  },
  {
    id: "memory",
    slug: "memory_recall",
    name: "Memory recall",
    description: "Search across past conversations and saved facts.",
    category: "data",
    enabled: true,
    installed: true,
  },
  {
    id: "code-run",
    slug: "code_execute",
    name: "Code execution",
    description: "Run Python / JS snippets in a sandbox.",
    category: "developer",
    enabled: false,
    installed: false,
  },
  {
    id: "whatsapp-send",
    slug: "whatsapp_send",
    name: "WhatsApp sender",
    description: "Send messages from your linked WhatsApp number.",
    category: "communication",
    enabled: false,
    installed: false,
  },
];
