import { PageShell } from "@/components/dashboard/page-shell";
import { Input } from "@/components/ui/input";

const sessions = [
  { id: "s1", title: "Launch plan for v2", channel: "web", messages: 12, updatedAt: "Today, 11:42" },
  { id: "s2", title: "WhatsApp triage bot", channel: "whatsapp", messages: 4, updatedAt: "Yesterday" },
  { id: "s3", title: "Refactor billing service", channel: "web", messages: 31, updatedAt: "2d ago" },
];

export default function SessionsPage() {
  return (
    <PageShell title="Sessions" subtitle="Search across every conversation you've had">
      <div className="mb-4">
        <Input placeholder="Search sessions…" className="rounded-xl" />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {sessions.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center justify-between px-4 py-3 ${
              i !== sessions.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">
                {s.channel} · {s.messages} messages
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{s.updatedAt}</span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
