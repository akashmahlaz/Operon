"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ProviderIcon } from "@lobehub/icons";
import { CheckCircle2, Code2, ExternalLink, Loader2, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface GitHubViewer {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepoSummary {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  defaultBranch: string;
  updatedAt: string;
  pushedAt: string | null;
  url: string;
}

export default function CodingPage() {
  const [token, setToken] = useState("");
  const [viewer, setViewer] = useState<GitHubViewer | null>(null);
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    setRepoLoading(true);
    try {
      const response = await fetch("/api/github?action=repos&perPage=30", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load repositories");
      setRepos(Array.isArray(data.repos) ? data.repos : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load repositories");
    } finally {
      setRepoLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/github?action=status", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to load GitHub status");
      setViewer(data.connected ? data.viewer : null);
      if (data.connected) await loadRepos();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load GitHub status");
    } finally {
      setLoading(false);
    }
  }, [loadRepos]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStatus();
    });
  }, [loadStatus]);

  async function connectGitHub() {
    if (!token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "GitHub connection failed");
      setViewer(data.viewer);
      setRepos(Array.isArray(data.repos) ? data.repos : []);
      setToken("");
      toast.success(`Connected GitHub as ${data.viewer.login}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "GitHub connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function disconnectGitHub() {
    try {
      const response = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (!response.ok) throw new Error("Failed to disconnect GitHub");
      setViewer(null);
      setRepos([]);
      toast.success("GitHub disconnected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect GitHub");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Coding</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Connect GitHub so Operon can inspect repos, read files, and prepare code work from chat.</p>
          </div>
          <Badge variant={viewer ? "default" : "outline"} className="w-fit gap-1.5 rounded-full">
            {viewer ? <CheckCircle2 className="size-3.5" /> : <PlugZap className="size-3.5" />}
            {viewer ? "GitHub connected" : "GitHub not connected"}
          </Badge>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Connection issue</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-background">
                  <ProviderIcon provider="github" size={26} type="color" />
                </span>
                <div>
                  <CardTitle>GitHub connector</CardTitle>
                  <CardDescription>Personal access token based setup</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-20" />
                </div>
              ) : viewer ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <Image src={viewer.avatar_url} alt="" width={40} height={40} unoptimized className="size-10 rounded-full" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{viewer.name || viewer.login}</p>
                      <a href={viewer.html_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        @{viewer.login} <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                  <Alert>
                    <ShieldCheck />
                    <AlertTitle>Ready for coding tasks</AlertTitle>
                    <AlertDescription>Operon can now use this token for repository listing and code-aware GitHub operations.</AlertDescription>
                  </Alert>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={loadRepos} disabled={repoLoading} className="flex-1 gap-2 rounded-xl">
                      {repoLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      Refresh repos
                    </Button>
                    <Button variant="ghost" onClick={disconnectGitHub} className="gap-2 rounded-xl text-destructive hover:text-destructive">
                      <Unplug className="size-4" /> Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-token">GitHub token</Label>
                    <Input
                      id="github-token"
                      type="password"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder="ghp_... or github_pat_..."
                      className="rounded-xl font-mono text-xs"
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">Use a fine-grained token with repository read access. Add contents write later when you want Operon to push code.</p>
                  </div>
                  <Button onClick={connectGitHub} disabled={connecting || !token.trim()} className="w-full gap-2 rounded-xl">
                    {connecting ? <Loader2 className="size-4 animate-spin" /> : <Code2 className="size-4" />}
                    Connect and fetch repos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Repositories</CardTitle>
                  <CardDescription>{viewer ? "Recently pushed repositories from your GitHub account" : "Connect GitHub to see repositories here"}</CardDescription>
                </div>
                {repos.length > 0 && <Badge variant="secondary" className="rounded-full">{repos.length}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {repoLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : repos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repository</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Open</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {repos.map((repo) => (
                      <TableRow key={repo.id}>
                        <TableCell className="max-w-80 whitespace-normal">
                          <div className="font-medium">{repo.fullName}</div>
                          <div className="line-clamp-1 text-xs text-muted-foreground">{repo.description || "No description"}</div>
                        </TableCell>
                        <TableCell>{repo.language || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{repo.defaultBranch}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${repo.fullName}`}>
                            <a href={repo.url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
                  <Code2 className="mb-3 size-9 text-muted-foreground" />
                  <p className="text-sm font-medium">No repositories loaded</p>
                  <p className="mt-1 text-xs text-muted-foreground">Connect GitHub and Operon will fetch your repo list immediately.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
