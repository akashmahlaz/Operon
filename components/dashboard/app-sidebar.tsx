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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperonMark } from "@/components/brand";
import { useOperonSession } from "@/components/ui/session-provider";
import { clearOperonSession } from "@/lib/operon-api";
import { dashboardNav } from "@/lib/nav";
import type { ConversationSummary } from "@/lib/types";
import { Plus, Search, LogOut, Settings, User, MoreHorizontal, Trash2, Clock } from "lucide-react";

interface AppSidebarProps {
  conversations?: ConversationSummary[];
  user?: { name?: string | null; email?: string | null; image?: string | null; display_name?: string | null };
}

const groupLabels: Record<string, string> = {
  workspace: "Workspace",
  build: "Build",
  system: "System",
};

export function AppSidebar({ conversations = [], user }: AppSidebarProps) {
  const pathname = usePathname();
  const session = useOperonSession();
  const currentUser = session.user ?? user;
  const [query, setQuery] = React.useState("");

  const filteredConversations = React.useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const initials = (currentUser?.name ?? currentUser?.display_name ?? currentUser?.email ?? "U")
    .split(/\s+/)
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const groups = (["workspace", "build", "system"] as const).map((g) => ({
    key: g,
    items: dashboardNav.filter((i) => i.group === g),
  }));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Header */}
      <SidebarHeader className="gap-2.5 px-3 pb-2 pt-3">
        <Link href="/dashboard/chat" className="flex items-center gap-2.5 py-0.5">
          <OperonMark className="size-7 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden font-semibold text-[15px] tracking-tight text-foreground">
            Operon
          </span>
        </Link>

        <div className="group-data-[collapsible=icon]:hidden">
          <Button
            asChild
            variant="outline"
            className="w-full justify-start gap-2 rounded-lg border-border/60 text-sm"
          >
            <Link href="/dashboard/chat?new=1">
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Link>
          </Button>
        </div>

        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 rounded-lg bg-muted/50 pl-8 text-xs"
          />
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* Navigation */}
        {groups.map(({ key, items }) => (
          <SidebarGroup key={key} className="py-1">
            <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {groupLabels[key]}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.title}
                        className="rounded-lg"
                      >
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

        {/* Recent conversations — grouped by date (Copilot-style) */}
        {conversations.length > 0 && (
          <SidebarGroup className="mt-1 py-1">
            <SidebarGroupLabel className="flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 group-data-[collapsible=icon]:hidden">
              <Clock className="size-3" /> Recent
            </SidebarGroupLabel>
            <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
              <ConversationDateGroups items={filteredConversations} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border pt-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="rounded-lg data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-7 w-7 rounded-md">
                    {currentUser?.image ? <AvatarImage src={currentUser.image} alt={currentUser.name ?? currentUser.display_name ?? "User"} /> : null}
                    <AvatarFallback className="rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-[13px] font-medium">{currentUser?.name ?? currentUser?.display_name ?? "Guest"}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {currentUser?.email ?? "Sign in to sync"}
                    </span>
                  </div>
                  <MoreHorizontal className="ml-auto h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel className="text-xs text-muted-foreground">My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <User className="mr-2 h-3.5 w-3.5" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-3.5 w-3.5" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => { clearOperonSession(); window.location.href = "/"; }}
                >
                  <LogOut className="mr-2 h-3.5 w-3.5" /> Log out
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

// ────────────────────────────────────────────────────────────────────────
// ConversationDateGroups — Copilot-style date bucketing.
// Buckets: Today / Yesterday / Previous 7 days / Previous 30 days / Older
// ────────────────────────────────────────────────────────────────────────
function ConversationDateGroups({
  items,
  pathname,
}: {
  items: ConversationSummary[];
  pathname: string;
}) {
  const groups = React.useMemo(() => bucketByDate(items), [items]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2 px-1">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
            {group.label}
          </div>
          <div className="mt-0.5 space-y-0.5">
            {group.items.map((c) => {
              const id = c._id ?? c.id;
              const channel = c.channel ?? "web";
              const href =
                channel === "coding"
                  ? `/dashboard/coding?id=${id}`
                  : `/dashboard/chat?id=${id}`;
              const active =
                pathname.startsWith(channel === "coding" ? "/dashboard/coding" : "/dashboard/chat") &&
                pathname.includes(id);
              return (
                <div key={id} className="group/conv relative">
                  <Link
                    href={href}
                    className={
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors " +
                      (active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground")
                    }
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                    <span className="truncate">{c.title || "Untitled"}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function bucketByDate(items: ConversationSummary[]) {
  const now = Date.now();
  const dayMs = 86_400_000;
  const today: ConversationSummary[] = [];
  const yesterday: ConversationSummary[] = [];
  const prev7: ConversationSummary[] = [];
  const prev30: ConversationSummary[] = [];
  const older: ConversationSummary[] = [];

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  for (const c of items) {
    const ts = Date.parse(c.updatedAt) || 0;
    const age = now - ts;
    if (ts >= todayMs) today.push(c);
    else if (ts >= todayMs - dayMs) yesterday.push(c);
    else if (age < dayMs * 7) prev7.push(c);
    else if (age < dayMs * 30) prev30.push(c);
    else older.push(c);
  }

  return [
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Previous 7 days", items: prev7 },
    { label: "Previous 30 days", items: prev30 },
    { label: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}
