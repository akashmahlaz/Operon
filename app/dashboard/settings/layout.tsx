import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  adminDashboardSections,
} from "@/components/dashboard/dashboard-sections";
import { SettingsTabs } from "@/components/dashboard/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Providers, workspace, persona, and admin tools
          </p>
        </div>

        {/* Brilion-style top tabs */}
        <SettingsTabs />

        {/* Child route content */}
        <div className="mt-6">{children}</div>

        {/* Admin row (Brilion exposes these as standalone routes; we surface them here too) */}
        <Card className="mt-10 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Admin</p>
            <p className="text-[11px] text-muted-foreground">Operate Operon</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {adminDashboardSections.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
