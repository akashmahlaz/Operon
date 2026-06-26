/**
 * Site-wide constants used by navigation and SEO.
 */

import {
  MessageSquare,
  Search,
  Globe,
  Package,
  Bell,
  FileBarChart,
  BookOpen,
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
  { title: "Explore", href: "/dashboard/explore", icon: Search, group: "workspace" },
  { title: "Domains", href: "/dashboard/domains", icon: Globe, group: "workspace" },
  { title: "Inventory", href: "/dashboard/inventory", icon: Package, group: "workspace" },
  { title: "Monitor", href: "/dashboard/monitor", icon: Bell, group: "build" },
  { title: "Reports", href: "/dashboard/reports", icon: FileBarChart, group: "build" },
  { title: "Knowledge", href: "/dashboard/knowledge", icon: BookOpen, group: "build" },
  { title: "Settings", href: "/dashboard/settings", icon: Settings, group: "system" },
];

export const marketingNav = [
  { title: "Product", href: "/#features" },
  { title: "Use cases", href: "/#how-it-works" },
  { title: "Pricing", href: "/#pricing" },
  { title: "Docs", href: "/docs" },
];
