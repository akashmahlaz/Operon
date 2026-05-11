"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, Layers2, Megaphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operonToken } from "@/lib/operon-api";

interface MetaStatus {
  connected: boolean;
  user?: { id: string; name: string };
  adAccountsCount?: number;
}

type Connector = {
  id: string;
  name: string;
  description: string;
  coverage: string;
  href?: string;
  dependsOnMeta?: boolean;
};

const connectors: Connector[] = [
  {
    id: "facebook",
    name: "Facebook Ads",
    description: "Connect Meta account and operate campaigns, ad sets, and creatives from Operon AI.",
    coverage: "Campaign management",
    href: "/dashboard/social/facebook",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Use the same Meta connection for Instagram placements and audience targeting.",
    coverage: "Placement optimization",
    href: "/dashboard/social/facebook",
    dependsOnMeta: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Plan thought-leadership, demand-gen campaigns, and audience expansion.",
    coverage: "Planned connector",
  },
  {
    id: "x",
    name: "X / Twitter",
    description: "Run conversational ad campaigns and monitor reply sentiment.",
    coverage: "Planned connector",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    description: "Launch short-form campaign variants and automate testing loops.",
    coverage: "Planned connector",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Build video campaign structures and creative adaptation workflows.",
    coverage: "Planned connector",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    description: "Promote evergreen catalog content and shopping campaigns.",
    coverage: "Planned connector",
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "Activate community-native ad units and feedback-aware iteration.",
    coverage: "Planned connector",
  },
];

function authHeaders() {
  const token = operonToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SocialPage() {
  const [status, setStatus] = useState<MetaStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/social/meta/status", { headers: authHeaders(), cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load status");
        const data = (await res.json()) as MetaStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ connected: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const connectedCount = useMemo(() => {
    if (!status.connected) return 0;
    return connectors.filter((connector) => connector.id === "facebook" || connector.dependsOnMeta).length;
  }, [status.connected]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      <div className="border-b border-border/40 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold">Social Connectors</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect channels, unlock AI media buying workflows, and operate ads from one control surface.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="rounded-lg border border-border/70 px-3 py-2">
              <span className="text-muted-foreground">Connected</span>
              <div className="font-semibold text-foreground">{connectedCount}/{connectors.length}</div>
            </div>
            <div className="rounded-lg border border-border/70 px-3 py-2">
              <span className="text-muted-foreground">Meta ad accounts</span>
              <div className="font-semibold text-foreground">{status.adAccountsCount ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {connectors.map((connector) => {
              const isConnected = status.connected && (connector.id === "facebook" || connector.dependsOnMeta);
              const isActionable = Boolean(connector.href);

              return (
                <div
                  key={connector.id}
                  className="flex min-h-48 flex-col justify-between rounded-2xl border border-border/70 bg-card/70 p-5"
                >
                  <div>
                    <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {connector.id === "facebook" ? <Megaphone className="size-4" /> : <Layers2 className="size-4" />}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{connector.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{connector.description}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{connector.coverage}</div>
                    {isConnected ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Connected
                      </div>
                    ) : isActionable ? (
                      <Button asChild size="sm" className="w-full rounded-lg">
                        <Link href={connector.href!}>
                          Connect
                          <ArrowUpRight className="ml-1.5 size-3.5" />
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full rounded-lg" disabled>
                        Planned
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {status.connected && !loading ? (
            <div className="grid min-h-screen gap-4 lg:grid-cols-2">
              <div className="flex min-h-[42rem] flex-col rounded-2xl border border-border/70 bg-card/60 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  Connected Channel Intelligence
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Facebook and Instagram are now available to your AI operator. Operon can monitor spend, inspect campaign results, and recommend budget shifts.
                </p>
                <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                    <div className="text-xs text-muted-foreground">Primary owner</div>
                    <div className="mt-1 font-medium text-foreground">{status.user?.name ?? "Connected user"}</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                    <div className="text-xs text-muted-foreground">Ad accounts</div>
                    <div className="mt-1 font-medium text-foreground">{status.adAccountsCount ?? 0} detected</div>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4 sm:col-span-2">
                    <div className="text-xs text-muted-foreground">AI managed workflows</div>
                    <div className="mt-1 text-foreground">
                      Campaign triage, budget recommendation, audience experimentation, and creative briefing.
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-[42rem] flex-col rounded-2xl border border-border/70 bg-card/60 p-6">
                <div className="text-sm font-semibold text-foreground">Facebook Ads Workspace</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open the dedicated workspace to connect assets, inspect campaign insights, generate ad set blueprints, and execute pause/resume safely.
                </p>
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4 text-sm text-foreground">
                    Rich account + campaign explorer with direct Meta Graph queries.
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4 text-sm text-foreground">
                    AI-generated ad set strategy cards grounded in live campaign metrics.
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/90 p-4 text-sm text-foreground">
                    Controlled execution actions for operational safety in MVP.
                  </div>
                </div>
                <div className="mt-auto pt-6">
                  <Button asChild className="w-full rounded-lg">
                    <Link href="/dashboard/social/facebook">Open Facebook Workspace</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 text-sm text-muted-foreground">
              Connect Facebook first to unlock the deep AI ad operations workspace.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}