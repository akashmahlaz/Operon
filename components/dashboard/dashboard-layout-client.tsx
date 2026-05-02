"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";
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

interface DashboardLayoutClientProps {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  children: React.ReactNode;
}

export function DashboardLayoutClient({ user, children }: DashboardLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const SettingsIcon = settingsDashboardSection.icon;

  const isSettings = pathname.startsWith("/dashboard/settings");
  const activeSection = isSettings
    ? "settings"
    : allDashboardSections.find((s) => pathname.startsWith(s.href))?.id ?? "chat";

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <TooltipProvider>
      <div className="flex h-dvh bg-background">
        {/* ── Icon rail ── */}
        <nav className="flex w-15 shrink-0 flex-col items-center border-r border-border/60 bg-sidebar py-3">
          {/* Logo */}
          <Link href="/dashboard/chat" className="mb-5 flex size-9 items-center justify-center">
            <OperonMark className="size-7" />
          </Link>

          {/* Primary nav */}
          <div className="flex flex-1 flex-col items-center gap-1">
            {primaryDashboardSections.map((section) => {
              const isActive = activeSection === section.id;
              const Icon = section.icon;
              return (
                <Tooltip key={section.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={section.href}
                      className={cn(
                        "group relative flex size-10 items-center justify-center rounded-xl transition-all duration-150",
                        isActive
                          ? `${section.bg} ${section.text} shadow-xs`
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4.5 shrink-0" />
                      {isActive && (
                        <span className="absolute -left-3.25 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r-full bg-current opacity-70" />
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className="font-medium">
                    {section.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* Bottom: Settings + Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="mb-1 h-px w-7 bg-border/60" />
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/settings"
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl transition-all duration-150",
                    isSettings
                      ? "bg-primary/10 text-primary shadow-xs"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <SettingsIcon className="size-4.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10} className="font-medium">
                Settings
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-accent focus:outline-none">
                  <Avatar className="size-7 ring-2 ring-border">
                    {user?.image ? <AvatarImage src={user.image} alt={user.name || ""} /> : null}
                    <AvatarFallback className="bg-foreground text-background text-[11px] font-semibold">
                      {userInitial}
                    </AvatarFallback>
                  </Avatar>
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
        </nav>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </TooltipProvider>
  );
}
