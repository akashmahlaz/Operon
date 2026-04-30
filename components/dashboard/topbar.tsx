"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Sparkles } from "lucide-react";

interface DashboardTopbarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DashboardTopbar({ title, subtitle, actions }: DashboardTopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        {title && <span className="truncate text-sm font-medium">{title}</span>}
        {subtitle && (
          <span className="truncate text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="What's new">
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
