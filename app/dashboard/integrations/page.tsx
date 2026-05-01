"use client";

import { builtInIntegrations } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Plug2 } from "lucide-react";
import { toast } from "sonner";

export default function IntegrationsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connect the tools you already use
          </p>
        </div>

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
                onClick={() => toast.info(`${i.name} integration coming soon`)}
              >
                {i.connected ? "Manage" : "Connect"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
