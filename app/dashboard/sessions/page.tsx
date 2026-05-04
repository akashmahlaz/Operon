"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Search } from "lucide-react";
import Link from "next/link";

interface ConvSummary {
  _id: string;
  title: string;
  channel: string;
  messageCount?: number;
  updatedAt: string;
  createdAt: string;
}

function formatRelative(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 2) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function SessionsPage() {
  const [convs, setConvs] = useState<ConvSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", { cache: "no-store" });
      const data = await res.json();
      setConvs(Array.isArray(data) ? data : []);
    } catch {
      setConvs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = query
    ? convs.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : convs;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Search across every conversation you&apos;ve had
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search sessions…"
            className="rounded-xl pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Skeleton className="size-4 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-3 w-12 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
            <MessageSquare className="mb-2 size-8 text-muted-foreground" />
            <p className="font-medium">
              {query ? "No matching sessions" : "No sessions yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query
                ? "Try a different search term"
                : "Start a chat to see your history here"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {filtered.map((s, i) => (
              <Link
                key={s._id}
                href={`/dashboard/chat?id=${s._id}`}
                className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted ${
                  i !== filtered.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.channel}
                      {s.messageCount ? ` · ${s.messageCount} messages` : ""}
                    </p>
                  </div>
                </div>
                <span className="ml-4 shrink-0 font-mono text-xs text-muted-foreground">
                  {formatRelative(s.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
