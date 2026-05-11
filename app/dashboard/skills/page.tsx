"use client";

import { useEffect, useState } from "react";
import { builtInSkills } from "@/lib/skills";
import { operonToken } from "@/lib/operon-api";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, Wrench } from "lucide-react";

interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  trigger?: string;
  steps: Array<{ tool: string; args: Record<string, unknown>; note?: string }>;
  invocationCount: number;
  successCount: number;
  failureCount: number;
  lastUsedAt?: string;
  updatedAt: string;
}

export default function SkillsPage() {
  const [agentSkills, setAgentSkills] = useState<AgentSkill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = operonToken();
    fetch("/api/agent-skills", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (!cancelled) setAgentSkills((data.skills as AgentSkill[]) ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <header>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Skills</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tools and learned recipes your agent can call
          </p>
        </header>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Agent skills (procedural memory)</h2>
            <Badge variant="outline" className="text-[10px]">Hermes-style</Badge>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Multi-step recipes the agent saves after a successful run, then recalls when you ask
            for something similar. The more you use them, the more reliable they become.
          </p>

          {error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load saved skills: {error}
            </div>
          ) : agentSkills === null ? (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : agentSkills.length === 0 ? (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No saved skills yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  After the agent successfully completes a multi-step workflow it will offer to
                  save it as a reusable skill. They will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {agentSkills.map((s) => {
                const total = s.successCount + s.failureCount;
                const successRate = total > 0 ? Math.round((s.successCount / total) * 100) : null;
                return (
                  <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{s.name}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {s.steps.length} step{s.steps.length === 1 ? "" : "s"}
                          </Badge>
                          {s.tags?.slice(0, 4).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[10px]">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                      </div>
                      <div className="shrink-0 text-right text-[11px] text-muted-foreground">
                        <div>{s.invocationCount} run{s.invocationCount === 1 ? "" : "s"}</div>
                        {successRate !== null && <div>{successRate}% success</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Built-in tool catalog</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {builtInSkills.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.name}</p>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {s.slug}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {s.category}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
                <Switch defaultChecked={s.enabled} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
