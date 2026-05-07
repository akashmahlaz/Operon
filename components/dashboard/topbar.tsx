"use client";

import * as React from "react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { OperonMark } from "@/components/brand";
import { Sun, Moon } from "lucide-react";

interface DashboardTopbarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function DashboardTopbar({ title, subtitle, actions }: DashboardTopbarProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/60">
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
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Operon">
          <OperonMark className="size-5 rounded-md bg-transparent text-foreground" />
        </Button>
      </div>
    </header>
  );
}
