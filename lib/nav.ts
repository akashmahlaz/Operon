/**
 * Site-wide constants used by navigation and SEO.
 */

import {
  MessageSquare,
  Sparkles,
  Wrench,
  Plug,
  Calendar,
  History,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  group: "workspace" | "build" | "system";
}

export const dashboardNav: DashboardNavItem[] = [
  { title: "Chat", href: "/dashboard/chat", icon: MessageSquare, group: "workspace" },
  { title: "Agents", href: "/dashboard/agents", icon: Sparkles, group: "build" },
  { title: "Skills", href: "/dashboard/skills", icon: Wrench, group: "build" },
  { title: "Integrations", href: "/dashboard/integrations", icon: Plug, group: "build" },
  { title: "Scheduler", href: "/dashboard/scheduler", icon: Calendar, group: "system" },
  { title: "Sessions", href: "/dashboard/sessions", icon: History, group: "system" },
  { title: "Logs", href: "/dashboard/logs", icon: ScrollText, group: "system" },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, group: "system" },
];

export const marketingNav = [
  { title: "Product", href: "/#features" },
  { title: "Use cases", href: "/#how-it-works" },
  { title: "Pricing", href: "/#pricing" },
  { title: "Docs", href: "/docs" },
];
