"use client";

import { Input } from "@/components/ui/input";
import { MessageSquare, Search } from "lucide-react";
import Link from "next/link";

const sessions = [
  { id: "s1", title: "Launch plan for v2", channel: "web", messages: 12, updatedAt: "Today, 11:42" },
  { id: "s2", title: "WhatsApp triage bot", channel: "whatsapp", messages: 4, updatedAt: "Yesterday" },
  { id: "s3", title: "Refactor billing service", channel: "web", messages: 31, updatedAt: "2d ago" },
];

export default function SessionsPage() {
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
          <Input placeholder="Search sessions…" className="rounded-xl pl-9" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {sessions.map((s, i) => (
            <Link
              key={s.id}
              href={`/dashboard/chat?id=${s.id}`}
              className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted ${
                i !== sessions.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.channel} · {s.messages} messages
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{s.updatedAt}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
