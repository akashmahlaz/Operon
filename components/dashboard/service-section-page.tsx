import { CheckCircle2, ExternalLink, PlugZap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardIcon } from "@/components/dashboard/dashboard-sections";

export interface ServiceCardItem {
  id: string;
  name: string;
  description: string;
  icon: DashboardIcon;
  accentClass: string;
  status: "connected" | "available" | "planned";
  stats?: string;
}

interface ServiceSectionPageProps {
  title: string;
  subtitle: string;
  services: ServiceCardItem[];
}

const statusLabel: Record<ServiceCardItem["status"], string> = {
  connected: "Connected",
  available: "Available",
  planned: "Planned",
};

export function ServiceSectionPage({ title, subtitle, services }: ServiceSectionPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const connected = service.status === "connected";
            return (
              <Card key={service.id} className="overflow-hidden transition-shadow hover:shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex size-10 items-center justify-center rounded-xl", service.accentClass)}>
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{service.name}</CardTitle>
                        <CardDescription className="mt-0.5 line-clamp-1">
                          {service.stats ?? "Ready for setup"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={connected ? "default" : "outline"} className="shrink-0">
                      {statusLabel[service.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="min-h-10 text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    <Button size="sm" variant={connected ? "outline" : "default"} className="rounded-full">
                      {connected ? <CheckCircle2 className="mr-1.5 size-3.5" /> : <PlugZap className="mr-1.5 size-3.5" />}
                      {connected ? "Manage" : service.status === "planned" ? "Preview" : "Connect"}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8 rounded-full" aria-label={`Open ${service.name} docs`}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}