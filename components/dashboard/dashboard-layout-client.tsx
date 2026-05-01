"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, PanelLeft, PanelLeftClose, Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  allDashboardSections,
  primaryDashboardSections,
  settingsDashboardSection,
} from "@/components/dashboard/dashboard-sections";
import { cn } from "@/lib/utils";

interface DashboardLayoutClientProps {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function DashboardLayoutClient({ user, children }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const SettingsIcon = settingsDashboardSection.icon;

  const isSettings = pathname.startsWith("/dashboard/settings");
  const activeSection = isSettings
    ? "settings"
    : allDashboardSections.find((s) => pathname.startsWith(s.href))?.id ?? "chat";

  const renderNavItem = (section: (typeof allDashboardSections)[number]) => {
    const isActive = activeSection === section.id;
    const Icon = section.icon;
    return (
      <Tooltip key={section.id} delayDuration={0}>
        <TooltipTrigger asChild>
          <Link
            href={section.href}
            className={cn(
              "relative flex items-center gap-2.5 rounded-xl transition-all duration-200",
              expanded ? "px-3 py-2.5" : "size-10 justify-center",
              isActive
                ? `${section.bg} ${section.text}`
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon className="size-4.5 shrink-0" />
            {expanded && (
              <span className={cn("text-[13px]", isActive ? "font-semibold" : "font-medium")}>
                {section.label}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        {!expanded && (
          <TooltipContent side="right" sideOffset={8} className="font-medium">
            {section.label}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-dvh bg-background">
      {/* Main Sidebar */}
      <nav
        className={cn(
          "flex shrink-0 flex-col border-r border-border bg-sidebar backdrop-blur-xl transition-all duration-300 ease-out",
          expanded ? "w-57" : "w-20"
        )}
      >
        {/* Logo + expand toggle */}
        <div
          className={cn(
            "flex items-center shrink-0 h-14",
            expanded ? "px-3.5 justify-between" : "justify-center"
          )}
        >
          <Link
            href="/dashboard/chat"
            className={cn(
              "flex items-center gap-2.5",
              expanded ? "px-1.5" : ""
            )}
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-foreground shadow-[inset_0_0_12px_rgba(255,255,255,0.15)]">
              <Sparkles className="size-4 text-background" />
            </div>
            {expanded && (
              <span className="font-heading text-[15px] font-bold text-foreground tracking-tight">
                Operon
              </span>
            )}
          </Link>
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <PanelLeftClose className="size-4" />
            </button>
          )}
        </div>

        {!expanded && (
          <div className="flex justify-center mb-2">
            <button
              onClick={() => setExpanded(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <PanelLeft className="size-4" />
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className={cn("flex flex-1 flex-col gap-1", expanded ? "px-2" : "items-center")}>
          {primaryDashboardSections.map(renderNavItem)}
        </div>

        {/* Bottom: Settings + User */}
        <div
          className={cn(
            "flex flex-col gap-1.5 mt-auto pb-3",
            expanded ? "px-2" : "items-center"
          )}
        >
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Link
                href="/dashboard/settings"
                className={cn(
                  "flex items-center gap-2.5 rounded-xl transition-all duration-200",
                  expanded ? "px-3 py-2.5" : "size-10 justify-center",
                  isSettings
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <SettingsIcon className="size-4.5 shrink-0" />
                {expanded && (
                  <span className="text-[13px] font-medium">Settings</span>
                )}
              </Link>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right" sideOffset={8} className="font-medium">
                Settings
              </TooltipContent>
            )}
          </Tooltip>

          <div className="mt-1 pt-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-accent transition-colors",
                    expanded ? "w-full" : ""
                  )}
                >
                  <Avatar className="size-8 ring-2 ring-border">
                    {user?.image ? (
                      <AvatarImage src={user.image} alt={user.name || ""} />
                    ) : null}
                    <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  {expanded && (
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[12px] font-medium text-foreground truncate">
                        {user?.name || "User"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                sideOffset={8}
                className="w-52 rounded-xl"
              >
                <div className="px-2 py-2">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="gap-2">
                    <SettingsIcon className="size-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                >
                  <LogOut className="size-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {children}
      </div>
      </div>
    </TooltipProvider>
  );
}
