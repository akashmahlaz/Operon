"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { operonFetch, operonToken, OPERON_API_URL } from "@/lib/operon-api";

interface GithubStatus {
  connected: boolean;
  login?: string | null;
}

function CodingPageInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (searchParams.get("connected") === "github") {
      toast.success("GitHub connected");
    } else if (searchParams.get("error")) {
      toast.error(`GitHub connection failed: ${searchParams.get("error")}`);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await operonFetch("/integrations/github/status");
        if (!res.ok) throw new Error("status failed");
        const data = (await res.json()) as GithubStatus;
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
  }, [searchParams]);

  function connectGithub() {
    setConnecting(true);
    const token = operonToken();
    if (!token) {
      toast.error("Sign in required");
      setConnecting(false);
      return;
    }
    window.location.href = `${OPERON_API_URL}/auth/oauth/github?token=${encodeURIComponent(token)}`;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">Coding</h1>
          <p className="text-xs text-muted-foreground">
            Connect the tools your coding agent will operate on.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ConnectorCard
              icon={<GitBranch className="size-5" />}
              title="GitHub"
              description="Connect your GitHub account so the agent can read repositories, branches, issues, and pull requests on your behalf."
              connected={status?.connected ?? false}
              connectedLabel={status?.login ? `Connected as ${status.login}` : "Connected"}
              actionLabel="Connect GitHub"
              loading={loading || connecting}
              onAction={connectGithub}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectorCard({
  icon,
  title,
  description,
  connected,
  connectedLabel,
  actionLabel,
  loading,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected: boolean;
  connectedLabel: string;
  actionLabel: string;
  loading: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-44 flex-col justify-between rounded-xl border border-border bg-card p-5 transition-colors hover:border-border/80">
      <div>
        <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="mt-4">
        {connected ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3.5" />
            <span>{connectedLabel}</span>
          </div>
        ) : (
          <Button size="sm" disabled={loading} onClick={onAction} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Connecting…
              </>
            ) : (
              actionLabel
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function CodingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      }
    >
      <CodingPageInner />
    </Suspense>
  );
}

