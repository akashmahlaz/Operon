"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsTabs } from "@/components/dashboard/dashboard-sections";
import { cn } from "@/lib/utils";

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/30 p-1">
      {settingsTabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            <span className="font-medium">{tab.label}</span>
            <span className="hidden text-[11px] text-muted-foreground/80 lg:inline">
              {tab.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
