import { DashboardTopbar } from "@/components/dashboard/topbar";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className="flex h-svh flex-col">
      <DashboardTopbar title={title} subtitle={subtitle} actions={actions} />
      <div className={cn("flex-1 overflow-y-auto p-6", className)}>
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </div>
    </div>
  );
}

export function ComingSoon({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
      <p className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        coming soon
      </p>
    </div>
  );
}
