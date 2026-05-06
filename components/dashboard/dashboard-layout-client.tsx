"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, ChevronRight } from "lucide-react";
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
import { OperonMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import { useOperonSession } from "@/components/ui/session-provider";
import { clearOperonSession } from "@/lib/operon-api";

interface DashboardLayoutClientProps {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function DashboardLayoutClient({ user: initialUser, children }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useOperonSession();
  const user = session.user ?? initialUser;
  const [expanded, setExpanded] = useState(false);
  const SettingsIcon = settingsDashboardSection.icon;

  const isSettings = pathname.startsWith("/dashboard/settings");
  const activeSection = isSettings
    ? "settings"
    : allDashboardSections.find((s) => pathname.startsWith(s.href))?.id ?? "chat";

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <TooltipProvider>
      <div className="flex h-dvh bg-background">
        {/* ── Sidebar ── */}
        <nav
          className={cn(
            "flex shrink-0 flex-col border-r border-border/60 bg-sidebar transition-all duration-300 ease-out",
            expanded ? "w-52" : "w-15",
          )}
        >
          {/* Logo + expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "group flex items-center gap-2.5 py-4 transition-colors hover:opacity-80",
              expanded ? "px-4" : "justify-center",
            )}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            <OperonMark className="size-7 shrink-0" />
            {expanded && (
              <>
                <span className="flex-1 text-left text-[15px] font-semibold tracking-tight text-foreground">
                  Operon
                </span>
                <ChevronRight className="size-3.5 rotate-180 text-muted-foreground transition-transform duration-200" />
              </>
            )}
          </button>

          {/* Primary nav */}
          <div className={cn("flex flex-1 flex-col gap-0.5 px-2 pb-2")}>
            {primaryDashboardSections.map((section) => {
              const isActive = activeSection === section.id;
              const Icon = section.icon;
              return (
                <Tooltip key={section.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={section.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl transition-all duration-150",
                        expanded ? "px-3 py-2.5" : "size-10 justify-center mx-auto",
                        isActive
                          ? `${section.bg} ${section.text} shadow-xs`
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" />
                      {expanded && (
                        <span className={cn("text-[13px]", isActive ? "font-semibold" : "font-medium")}>
                          {section.label}
                        </span>
                      )}
                      {isActive && !expanded && (
                        <span className="absolute -left-3.25 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-full bg-current opacity-70" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  {!expanded && (
                    <TooltipContent side="right" sideOffset={10} className="font-medium">
                      {section.label}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>

          {/* Bottom: Settings + Avatar */}
          <div className={cn("flex flex-col gap-1 px-2 pb-3")}>
            <div className="mb-1 h-px bg-border/60" />
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl transition-all duration-150",
                    expanded ? "px-3 py-2.5" : "size-10 justify-center mx-auto",
                    isSettings
                      ? "bg-primary/10 text-primary shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <SettingsIcon className="size-4.5" />
                  {expanded && (
                    <span className={cn("text-[13px]", isSettings ? "font-semibold" : "font-medium")}>
                      Settings
                    </span>
                  )}
                </Link>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent side="right" sideOffset={10} className="font-medium">
                  Settings
                </TooltipContent>
              )}
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl p-1.5 transition-colors hover:bg-accent focus:outline-none",
                    expanded ? "w-full" : "mx-auto",
                  )}
                >
                  <Avatar className="size-7 shrink-0 ring-2 ring-border">
                    {user?.image ? <AvatarImage src={user.image} alt={user.name || ""} /> : null}
                    <AvatarFallback className="bg-foreground text-background text-[11px] font-semibold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
                  {expanded && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-[12px] font-medium text-foreground">{user?.name || "User"}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-52 rounded-xl">
                <div className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="gap-2">
                    <Settings className="size-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={() => { clearOperonSession(); router.push("/"); }}
                >
                  <LogOut className="size-3.5" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}
