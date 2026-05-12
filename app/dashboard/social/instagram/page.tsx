"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Layers2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { operonToken } from "@/lib/operon-api";

interface MetaStatus {
  connected: boolean;
  user?: { id: string; name: string };
  adAccountsCount?: number;
}

function authHeaders() {
  const headers = new Headers();
  const token = operonToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export default function InstagramPage() {
  const [status, setStatus] = useState<MetaStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/social/meta/status", {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (!res.ok) throw new Error("status failed");
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

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      <div className="border-b border-border/40 px-6 py-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          <Link href="/dashboard/social" className="hover:text-foreground">Social</Link>
          <span className="mx-1.5">/</span>
          Instagram
        </div>
        <h1 className="mt-1 text-base font-semibold">Instagram Connector Workspace</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Instagram uses your Meta connection. Activate Facebook once and Operon AI can run IG campaign workflows.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="grid min-h-screen gap-4 lg:grid-cols-2">
            <div className="flex min-h-168 flex-col rounded-2xl border border-border/70 bg-card/70 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Layers2 className="size-4 text-primary" />
                Instagram readiness
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                When Meta is connected, Instagram placements and ad delivery controls become available automatically.
              </p>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <p className="text-xs text-muted-foreground">Connection state</p>
                  <p className="mt-1 font-medium text-foreground">
                    {loading ? "Checking..." : status.connected ? "Connected" : "Not connected"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <p className="text-xs text-muted-foreground">Owner</p>
                  <p className="mt-1 font-medium text-foreground">{status.user?.name ?? "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <p className="text-xs text-muted-foreground">Ad accounts</p>
                  <p className="mt-1 font-medium text-foreground">{status.adAccountsCount ?? 0}</p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <Button asChild className="w-full rounded-lg">
                  <Link href="/dashboard/social/facebook">
                    {status.connected ? "Open Facebook + Meta Control" : "Connect Meta First"}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex min-h-168 flex-col rounded-2xl border border-border/70 bg-card/70 p-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="size-4 text-primary" />
                AI Instagram operations
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                After connection, tell Operon AI what you want and it will execute from strategy to optimization.
              </p>

              <div className="mt-5 space-y-3 text-sm text-foreground">
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  Create campaign + ad set structure for reels placements.
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  Generate multiple creative angle briefs for testing.
                </div>
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  Pause underperforming sets and reallocate spend automatically.
                </div>
                <div className="rounded-xl border border-emerald-300/40 bg-emerald-50/40 p-4 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <div className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-4" />
                    {status.connected ? "AI control ready" : "Connect Meta to unlock AI control"}
                  </div>
                  <p className="mt-2 text-sm">
                    {status.connected
                      ? "Now you can do Instagram growth operations completely from AI commands in Operon."
                      : "Once connected, your full Instagram ad operation can be managed by AI."}
                  </p>
                </div>
              </div>

              <div className="mt-auto pt-6">
                <div className="rounded-xl border border-border/70 bg-background/90 p-4">
                  <div className="mb-2 inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    <BarChart3 className="size-3.5" /> Example AI prompt
                  </div>
                  <p className="text-sm text-foreground">
                    "Create 3 Instagram ad sets for our summer offer, budget split by audience intent, then pause low-CTR sets after 48 hours."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
