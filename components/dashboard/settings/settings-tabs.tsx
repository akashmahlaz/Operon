"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { settingsTabs } from "@/components/dashboard/dashboard-sections";
import { cn } from "@/lib/utils";

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="mx-auto flex max-w-5xl gap-1 px-4 lg:px-6">
      {settingsTabs.map((tab) => {
        const Icon = tab.icon;
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "group relative -mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
