import { PageShell } from "@/components/dashboard/page-shell";
import { builtInIntegrations } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Plug2 } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <PageShell
      title="Integrations"
      subtitle="Connect the tools you already use"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {builtInIntegrations.map((i) => (
          <div
            key={i.id}
            className="flex flex-col rounded-2xl border border-border bg-card p-5"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plug2 className="h-5 w-5" />
            </div>
            <p className="font-medium">{i.name}</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {i.description}
            </p>
            <Button
              variant={i.connected ? "outline" : "default"}
              size="sm"
              className="mt-4 rounded-full"
            >
              {i.connected ? "Manage" : "Connect"}
            </Button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
