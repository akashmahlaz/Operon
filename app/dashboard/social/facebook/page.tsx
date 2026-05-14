"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { operonToken } from "@/lib/operon-api";

interface MetaStatus {
  connected: boolean;
  user?: { id: string; name: string };
  adAccountsCount?: number;
  adAccounts?: MetaAccount[];
}

interface MetaAccount {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  account_status?: number;
}

interface MetaCampaign {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
}

interface CampaignInsight {
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
}

function authHeaders(extra?: Record<string, string>) {
  const headers = new Headers(extra);
  const token = operonToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

function toCurrency(amount?: string, currency = "USD") {
  const value = Number(amount ?? "0");
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
}

export default function FacebookWorkspacePage() {
  const router = useRouter();
  const [status, setStatus] = useState<MetaStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [metaToken, setMetaToken] = useState("");

  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const [insights, setInsights] = useState<CampaignInsight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const aiAdSetBlueprint = useMemo(() => {
    if (!selectedCampaign) return null;

    return {
      objective: selectedCampaign.objective ?? "CONVERSIONS",
      campaign: selectedCampaign.name ?? "Untitled campaign",
      adSetName: `${selectedCampaign.name ?? "Campaign"} - AI Growth Cell`,
      budgetStrategy: selectedCampaign.daily_budget
        ? `Start at ${toCurrency(selectedCampaign.daily_budget, selectedAccount?.currency ?? "USD")} per day and rebalance by CPA every 48 hours.`
        : "Use a test budget split: 60% broad audience, 40% high-intent lookalike.",
      audiencePlan: [
        "Core: buyer-intent behavior segment",
        "Expansion: 1-3% lookalike from converters",
        "Retargeting: site visitors from last 30 days",
      ],
      creativePlan: [
        "Variant A: value proposition in first 3 seconds",
        "Variant B: testimonial-led social proof",
        "Variant C: urgency + clear offer CTA",
      ],
      aiOpsChecklist: [
        "Auto-pause creatives with CTR below benchmark after 3k impressions",
        "Increase budget 20% for ad sets with stable CPA for 2 consecutive days",
        "Generate next creative brief from top-performing hooks",
      ],
    };
  }, [selectedCampaign, selectedAccount?.currency]);

  async function refreshStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/social/meta/status", {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Could not fetch Meta status");
      const data = (await res.json()) as MetaStatus;
      setStatus(data);

      if (data.connected) {
        const nextAccounts = data.adAccounts ?? [];
        setAccounts(nextAccounts);
        const firstAccountId = nextAccounts[0]?.id ?? "";
        setSelectedAccountId((current) => current || firstAccountId);
      } else {
        setAccounts([]);
        setSelectedAccountId("");
        setCampaigns([]);
        setSelectedCampaignId("");
        setInsights([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load status";
      toast.error(message);
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }

  async function connectMeta() {
    if (!metaToken.trim()) {
      toast.error("Paste a Meta user access token");
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch("/api/social/meta/connect", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ token: metaToken.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to connect Meta account");
      toast.success("Facebook connected successfully");
      setMetaToken("");
      await refreshStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Meta connect failed";
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  }

  async function loadCampaigns(accountId: string) {
    if (!accountId) return;
    setCampaignsLoading(true);
    setInsights([]);
    try {
      const url = `/api/social/meta/campaigns?adAccountId=${encodeURIComponent(accountId)}&limit=25`;
      const res = await fetch(url, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as { campaigns?: MetaCampaign[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load campaigns");

      const nextCampaigns = data.campaigns ?? [];
      setCampaigns(nextCampaigns);
      setSelectedCampaignId(nextCampaigns[0]?.id ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load campaigns";
      toast.error(message);
      setCampaigns([]);
      setSelectedCampaignId("");
    } finally {
      setCampaignsLoading(false);
    }
  }

  async function loadInsights(campaignId: string) {
    if (!campaignId) return;
    setInsightsLoading(true);
    try {
      const url = `/api/social/meta/insights?campaignId=${encodeURIComponent(campaignId)}&datePreset=last_7d`;
      const res = await fetch(url, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = (await res.json()) as { insights?: CampaignInsight[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load campaign insights");
      setInsights(data.insights ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load insights";
      toast.error(message);
      setInsights([]);
    } finally {
      setInsightsLoading(false);
    }
  }

  async function updateCampaign(action: "pause" | "resume") {
    if (!selectedCampaignId) {
      toast.error("Pick a campaign first");
      return;
    }

    setActionLoading(action);
    try {
      const res = await fetch("/api/social/meta/campaign-action", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ campaignId: selectedCampaignId, action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update campaign");
      toast.success(`Campaign ${action} request sent`);
      await loadCampaigns(selectedAccountId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Campaign action failed";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => {
    if (status.connected && selectedAccountId) {
      void loadCampaigns(selectedAccountId);
    }
  }, [status.connected, selectedAccountId]);

  useEffect(() => {
    if (selectedCampaignId) {
      void loadInsights(selectedCampaignId);
    }
  }, [selectedCampaignId]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading Facebook workspace...
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-background">
      <div className="border-b border-border/40 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              <Link href="/dashboard/social" className="hover:text-foreground">Social</Link>
              <span className="mx-1.5">/</span>
              Facebook
            </div>
            <h1 className="mt-1 text-base font-semibold">Facebook Ads Workspace</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect once, then let Operon AI inspect campaigns, generate ad-set strategy, and execute safe actions.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard/social")}>Back to Connectors</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {!status.connected ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
                <h2 className="text-sm font-semibold text-foreground">Connect Facebook (Meta)</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Paste a Meta user access token with ads scopes. Operon stores it securely and enables campaign operations.
                </p>
                <div className="mt-5 space-y-3">
                  <Input
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    placeholder="EAAB..."
                    className="h-11"
                  />
                  <Button onClick={connectMeta} disabled={connecting} className="w-full">
                    {connecting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Connecting
                      </>
                    ) : (
                      "Connect Facebook"
                    )}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/70 p-6">
                <h2 className="text-sm font-semibold text-foreground">MVP operational scope</h2>
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <p>1. Load ad accounts and campaigns from Meta Graph API.</p>
                  <p>2. Pull campaign insights for the last 7 days.</p>
                  <p>3. Pause or resume campaign execution directly.</p>
                  <p>4. Generate AI ad set blueprints from live campaign context.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                  label="Connection"
                  value={status.user?.name ?? "Connected"}
                />
                <MetricCard
                  icon={<Wallet className="size-4 text-primary" />}
                  label="Ad accounts"
                  value={String(accounts.length)}
                />
                <MetricCard
                  icon={<BarChart3 className="size-4 text-primary" />}
                  label="Campaigns"
                  value={String(campaigns.length)}
                />
                <MetricCard
                  icon={<TrendingUp className="size-4 text-primary" />}
                  label="Insight rows"
                  value={String(insights.length)}
                />
              </div>

              <div className="grid min-h-screen gap-4 lg:grid-cols-2">
                <div className="flex min-h-168 flex-col rounded-2xl border border-border/70 bg-card/70 p-6">
                  <h2 className="text-sm font-semibold text-foreground">Account and campaign operations</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Select an ad account, inspect campaigns, and control execution state.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-muted-foreground">Ad account</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name ?? account.id}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-muted-foreground">Campaign</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                      >
                        {campaigns.map((campaign) => (
                          <option key={campaign.id} value={campaign.id}>
                            {campaign.name ?? campaign.id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void loadCampaigns(selectedAccountId)}
                      disabled={campaignsLoading || !selectedAccountId}
                    >
                      {campaignsLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Refresh campaigns
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void loadInsights(selectedCampaignId)}
                      disabled={insightsLoading || !selectedCampaignId}
                    >
                      {insightsLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Refresh insights
                    </Button>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void updateCampaign("pause")}
                      disabled={actionLoading !== null || !selectedCampaignId}
                    >
                      {actionLoading === "pause" ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <PauseCircle className="mr-2 size-4" />
                      )}
                      Pause
                    </Button>
                    <Button
                      onClick={() => void updateCampaign("resume")}
                      disabled={actionLoading !== null || !selectedCampaignId}
                    >
                      {actionLoading === "resume" ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <PlayCircle className="mr-2 size-4" />
                      )}
                      Resume
                    </Button>
                  </div>

                  <div className="mt-5 overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Campaign</th>
                          <th className="px-3 py-2 text-left">Objective</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Daily budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaigns.map((campaign) => (
                          <tr key={campaign.id} className="border-t border-border/70">
                            <td className="px-3 py-2 text-foreground">{campaign.name ?? campaign.id}</td>
                            <td className="px-3 py-2 text-muted-foreground">{campaign.objective ?? "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{campaign.status ?? "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {toCurrency(campaign.daily_budget, selectedAccount?.currency ?? "USD")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex min-h-168 flex-col rounded-2xl border border-border/70 bg-card/70 p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="size-4 text-primary" />
                    AI Ads Operator
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Operon creates an ad-set blueprint from live campaign data and recent insights.
                  </p>

                  <div className="mt-4 overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Spend</th>
                          <th className="px-3 py-2 text-left">Impressions</th>
                          <th className="px-3 py-2 text-left">Clicks</th>
                          <th className="px-3 py-2 text-left">CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.map((item, idx) => (
                          <tr key={idx} className="border-t border-border/70">
                            <td className="px-3 py-2 text-muted-foreground">{item.spend ?? "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.impressions ?? "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.clicks ?? "-"}</td>
                            <td className="px-3 py-2 text-muted-foreground">{item.ctr ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-xl border border-border/70 bg-background/90 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Generated ad-set blueprint</p>
                    {aiAdSetBlueprint ? (
                      <pre className="mt-2 overflow-auto text-xs leading-relaxed text-foreground">
                        {JSON.stringify(aiAdSetBlueprint, null, 2)}
                      </pre>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Pick a campaign to generate your first AI-operated ad-set plan.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/70 p-4">
      <div className="mb-2 inline-flex size-8 items-center justify-center rounded-lg bg-primary/10">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
