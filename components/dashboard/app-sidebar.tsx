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
import { BrilionMark, BrilionWordmark } from "@/components/brand";
import { dashboardNav } from "@/lib/nav";
import type { ConversationSummary } from "@/lib/types";
import { Plus, Search, LogOut, Settings, User, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";

interface AppSidebarProps {
  conversations?: ConversationSummary[];
  user?: { name?: string | null; email?: string | null; image?: string | null };
}

const groupLabels: Record<string, string> = {
  workspace: "Workspace",
  build: "Build",
  system: "System",
};

const channelDot: Record<ConversationSummary["channel"], string> = {
  web: "bg-blue-500",
  whatsapp: "bg-emerald-500",
  telegram: "bg-sky-500",
};

export function AppSidebar({ conversations = [], user }: AppSidebarProps) {
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");

  const filteredConvs = React.useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
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
          <BrilionMark />
          <span className="group-data-[collapsible=icon]:hidden">
            <BrilionWordmark height={16} />
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
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Conversations */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            {filteredConvs.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No conversations yet. Start a new chat to see it here.
              </p>
            ) : (
              <SidebarMenu>
                {filteredConvs.map((c) => {
                  const href = `/dashboard/chat?c=${c.id}`;
                  const active = pathname === "/dashboard/chat" && typeof window !== "undefined" && window.location.search.includes(c.id);
                  return (
                    <SidebarMenuItem key={c.id}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link href={href} className="flex items-start gap-2 py-2">
                          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", channelDot[c.channel])} />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm">{c.title}</span>
                            {c.preview && (
                              <span className="truncate text-[11px] text-muted-foreground">{c.preview}</span>
                            )}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

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
