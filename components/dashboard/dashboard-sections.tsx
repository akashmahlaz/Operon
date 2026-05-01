import type { ComponentType } from "react";
import {
  BarChart3,
  Bot,
  Calendar,
  Code2,
  FileText,
  History,
  MessageSquare,
  Plug,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";

export type DashboardIcon = ComponentType<{ className?: string }>;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/**
 * Primary main-sidebar items (Brilion-exact: 5 sections + Settings at bottom).
 * Admin / Operate items live under Settings, NOT in the main sidebar.
 */
export const primaryDashboardSections = [
  { id: "chat", icon: MessageSquare, label: "Chat", href: "/dashboard/chat", bg: "bg-primary/8", text: "text-primary" },
  { id: "google", icon: GoogleIcon, label: "Google", href: "/dashboard/google", bg: "bg-blue-500/8", text: "text-blue-500" },
  { id: "social", icon: Share2, label: "Social", href: "/dashboard/social", bg: "bg-violet-500/8", text: "text-violet-500" },
  { id: "trading", icon: TrendingUp, label: "Trading", href: "/dashboard/trading", bg: "bg-emerald-500/8", text: "text-emerald-500" },
  { id: "coding", icon: Code2, label: "Coding", href: "/dashboard/coding", bg: "bg-amber-500/8", text: "text-amber-500" },
] as const;

/**
 * Admin pages exposed inside the Settings layout (Brilion treats these as standalone
 * routes that highlight the Settings button).
 */
export const adminDashboardSections = [
  { id: "overview", icon: BarChart3, label: "Overview", href: "/dashboard/overview", bg: "bg-primary/8", text: "text-primary" },
  { id: "agents", icon: Bot, label: "Agents", href: "/dashboard/agents", bg: "bg-violet-500/8", text: "text-violet-500" },
  { id: "skills", icon: Wrench, label: "Skills", href: "/dashboard/skills", bg: "bg-amber-500/8", text: "text-amber-500" },
  { id: "integrations", icon: Plug, label: "Integrations", href: "/dashboard/integrations", bg: "bg-emerald-500/8", text: "text-emerald-500" },
  { id: "scheduler", icon: Calendar, label: "Scheduler", href: "/dashboard/scheduler", bg: "bg-sky-500/8", text: "text-sky-500" },
  { id: "sessions", icon: History, label: "Sessions", href: "/dashboard/sessions", bg: "bg-pink-500/8", text: "text-pink-500" },
  { id: "logs", icon: ScrollText, label: "Logs", href: "/dashboard/logs", bg: "bg-orange-500/8", text: "text-orange-500" },
] as const;

/**
 * Brilion's Settings page has three top-level tabs.
 */
export const settingsTabs = [
  { id: "providers", icon: ShieldCheck, label: "Providers", href: "/dashboard/settings/providers", description: "AI keys & models" },
  { id: "workspace", icon: FileText, label: "Workspace", href: "/dashboard/settings/workspace", description: "Files & instructions" },
  { id: "persona", icon: Sparkles, label: "Persona", href: "/dashboard/settings/persona", description: "Identity & memory" },
] as const;

export const settingsDashboardSection = {
  id: "settings",
  icon: Settings,
  label: "Settings",
  href: "/dashboard/settings",
  bg: "bg-primary/8",
  text: "text-primary",
} as const;

export const allDashboardSections = [
  ...primaryDashboardSections,
  ...adminDashboardSections,
  settingsDashboardSection,
] as const;