"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperonMark, OperonWordmark } from "@/components/brand";
import { dashboardNav } from "@/lib/nav";
import type { ConversationSummary } from "@/lib/types";
import { Plus, Search, LogOut, Settings, User, MoreHorizontal, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  conversations?: ConversationSummary[];
  user?: { name?: string | null; email?: string | null; image?: string | null };
}

const SIDEBAR_HINT_KEY = "operon-sidebar-hint-seen";

function SidebarShortcutHint() {
  const { toggleSidebar, open } = useSidebar();
  const [firstTime, setFirstTime] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(SIDEBAR_HINT_KEY)) setFirstTime(true);
    } catch {}
  }, []);

  if (!open) return null;

  const markSeen = () => {
    if (firstTime) {
      setFirstTime(false);
      try {
        localStorage.setItem(SIDEBAR_HINT_KEY, "1");
      } catch {}
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        Shortcut
      </p>
      <button
        type="button"
        onClick={() => {
          markSeen();
          toggleSidebar();
        }}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors",
          firstTime
            ? "animate-pulse border border-primary/20 bg-primary/10 text-primary"
            : "bg-muted/50 text-muted-foreground hover:bg-muted",
        )}
      >
        <kbd className="inline-flex items-center justify-center rounded border border-border/60 bg-background px-1 py-0.5 font-mono text-[10px] leading-none">
          S
        </kbd>
        <span>Toggle sidebar</span>
      </button>
    </div>
  );
}

const groupLabels: Record<string, string> = {
  workspace: "Workspace",
  build: "Build",
  system: "System",
};

export function AppSidebar({ conversations = [], user }: AppSidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");

  const conversationCount = React.useMemo(() => {
    if (!query.trim()) return conversations.length;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q)).length;
  }, [conversations, query]);

  const initials = (user?.name ?? user?.email ?? "U")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const groups = (["workspace", "build", "system"] as const).map((g) => ({
    key: g,
    items: dashboardNav.filter((i) => i.group === g),
  }));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3">
        <Link href="/dashboard/chat" className="flex items-center gap-2 px-2 py-1">
          <OperonMark />
          <span className="group-data-[collapsible=icon]:hidden">
            <OperonWordmark height={16} />
          </span>
        </Link>

        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <Button
            asChild
            variant="outline"
            className="w-full justify-start gap-2 rounded-xl border-border bg-card/70 backdrop-blur-sm"
          >
            <Link href="/dashboard/chat?new=1">
              <Plus className="h-4 w-4" />
              New chat
            </Link>
          </Button>
        </div>

        <div className="relative px-2 group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="h-9 rounded-xl bg-card/50 pl-8 text-xs"
          />
          {query ? (
            <p className="mt-1 px-1 text-[10px] text-muted-foreground">
              {conversationCount} matches
            </p>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Navigation groups */}
        {groups.map(({ key, items }) => (
          <SidebarGroup key={key}>
            <SidebarGroupLabel>{groupLabels[key]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link href={item.href}>
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarShortcutHint />
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-medium text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{user?.name ?? "Guest"}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user?.email ?? "Sign in to sync"}
                    </span>
                  </div>
                  <MoreHorizontal className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <User className="mr-2 h-4 w-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// Tiny helper used by chat sidebar items if/when we wire delete inline.
export function _UnusedDeleteIcon() {
  return <Trash2 className="h-3.5 w-3.5" />;
}
