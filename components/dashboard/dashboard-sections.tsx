import type { ComponentType } from "react";
import {
  BarChart3,
  Bot,
  Calendar,
  FileText,
  History,
  MessageSquare,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

export type DashboardIcon = ComponentType<{ className?: string }>;

// ─────────────────────────────────────────────────────────────────
// Brand icons
// ─────────────────────────────────────────────────────────────────

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#1877F2" aria-hidden="true">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.235 2.686.235v2.97H15.83c-1.491 0-1.956.93-1.956 1.886v2.266h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

/**
 * Official Bitcoin SVG — path from bitcoin.org/en/press
 * Uses a 24×24 viewBox with the circular orange background + white ₿ mark.
 * Stays crisp at 18–24 px because all fine detail is in the white counter,
 * not in hairline strokes.
 */
function BitcoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.546z"
        fill="#F7931A"
      />
      <path
        d="M17.16 10.52c.24-1.62-.985-2.49-2.66-3.07l.543-2.18-1.327-.33-.53 2.12c-.349-.087-.707-.168-1.063-.25l.534-2.14-1.327-.33-.543 2.18c-.289-.066-.572-.132-.847-.2l.002-.008-1.83-.456-.353 1.418s.985.226.965.24c.538.134.635.49.619.772l-.62 2.488c.037.009.085.023.138.044l-.14-.035-.869 3.484c-.066.163-.233.408-.607.315.013.018-.965-.24-.965-.24l-.66 1.52 1.726.43c.321.08.636.164.946.243l-.549 2.202 1.325.33.543-2.18c.362.098.714.189 1.058.274l-.54 2.164 1.327.33.549-2.198c2.26.428 3.96.255 4.674-1.79.576-1.644-.029-2.591-1.217-3.21.866-.2 1.518-.77 1.692-1.946zm-3.03 4.25c-.41 1.644-3.185.755-4.086.532l.729-2.923c.9.225 3.787.67 3.357 2.391zm.41-4.27c-.374 1.498-2.686.737-3.438.55l.661-2.647c.752.187 3.173.537 2.777 2.097z"
        fill="white"
      />
    </svg>
  );
}

/**
 * Official VS Code icon — path sourced from the VS Code GitHub repository
 * (microsoft/vscode) and cross-referenced with the Simple Icons project (MIT).
 * Brand color: #007ACC (VS Code's official blue).
 */
function VSCodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#007ACC" aria-hidden="true">
      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 19.881V4.119a1.5 1.5 0 0 0-.85-1.532zm-5.146 14.861L10.826 12l7.178-5.448v10.896z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────
// Section type
// ─────────────────────────────────────────────────────────────────

export type DashboardSection = {
  id: string;
  icon: DashboardIcon;
  label: string;
  href: string;
  bg: string;
  text: string;
};

// ─────────────────────────────────────────────────────────────────
// Primary sidebar sections
// ─────────────────────────────────────────────────────────────────

export const primaryDashboardSections = [
  {
    id: "chat",
    icon: MessageSquare,
    label: "Chat",
    href: "/dashboard/chat",
    bg: "bg-primary/8",
    text: "text-primary",
  },
  {
    id: "google",
    icon: GoogleIcon,
    label: "Google",
    href: "/dashboard/google",
    // Solid Google blue — the multicolor icon carries the brand identity.
    bg: "bg-[#4285F4]/8",
    text: "text-[#4285F4]",
  },
  {
    id: "social",
    icon: FacebookIcon,
    label: "Social",
    href: "/dashboard/social",
    bg: "bg-[#1877F2]/8",
    text: "text-[#1877F2]",
  },
  {
    id: "trading",
    icon: BitcoinIcon,
    label: "Trading",
    href: "/dashboard/trading",
    bg: "bg-[#F7931A]/8",
    text: "text-[#F7931A]",
  },
  {
    id: "coding",
    icon: VSCodeIcon,
    label: "Coding",
    href: "/dashboard/coding",
    bg: "bg-[#007ACC]/8",
    text: "text-[#007ACC]",
  },
] as const satisfies readonly DashboardSection[];

// ─────────────────────────────────────────────────────────────────
// Admin sections (rendered inside the Settings layout)
// ─────────────────────────────────────────────────────────────────

export const adminDashboardSections = [
  {
    id: "overview",
    icon: BarChart3,
    label: "Overview",
    href: "/dashboard/overview",
    bg: "bg-primary/8",
    text: "text-primary",
  },
  {
    id: "agents",
    icon: Bot,
    label: "Agents",
    href: "/dashboard/agents",
    bg: "bg-violet-500/8",
    text: "text-violet-500",
  },
  {
    id: "skills",
    icon: Wrench,
    label: "Skills",
    href: "/dashboard/skills",
    bg: "bg-amber-500/8",
    text: "text-amber-500",
  },
  {
    id: "integrations",
    icon: Plug,
    label: "Integrations",
    href: "/dashboard/integrations",
    bg: "bg-emerald-500/8",
    text: "text-emerald-500",
  },
  {
    id: "scheduler",
    icon: Calendar,
    label: "Scheduler",
    href: "/dashboard/scheduler",
    bg: "bg-sky-500/8",
    text: "text-sky-500",
  },
  {
    id: "sessions",
    icon: History,
    label: "Sessions",
    href: "/dashboard/sessions",
    bg: "bg-pink-500/8",
    text: "text-pink-500",
  },
  {
    id: "logs",
    icon: ScrollText,
    label: "Logs",
    href: "/dashboard/logs",
    bg: "bg-orange-500/8",
    text: "text-orange-500",
  },
] as const satisfies readonly DashboardSection[];

// ─────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────

export const settingsTabs = [
  {
    id: "providers",
    icon: ShieldCheck,
    label: "Providers",
    href: "/dashboard/settings/providers",
    description: "AI keys & models",
  },
  {
    id: "workspace",
    icon: FileText,
    label: "Workspace",
    href: "/dashboard/settings/workspace",
    description: "Files & instructions",
  },
  {
    id: "persona",
    icon: Sparkles,
    label: "Persona",
    href: "/dashboard/settings/persona",
    description: "Identity & memory",
  },
] as const;

export const settingsDashboardSection: DashboardSection = {
  id: "settings",
  icon: Settings,
  label: "Settings",
  href: "/dashboard/settings",
  bg: "bg-primary/8",
  text: "text-primary",
};

export const allDashboardSections: readonly DashboardSection[] = [
  ...primaryDashboardSections,
  ...adminDashboardSections,
  settingsDashboardSection,
];