import { PageShell } from "@/components/dashboard/page-shell";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";

const sampleAgents = [
  {
    name: "Marketing autopilot",
    description: "Drafts, schedules and reports on social campaigns.",
    tools: ["web_search", "generate_image", "whatsapp_send"],
    enabled: true,
  },
  {
    name: "Inbox triage",
    description: "Reads new mail, drafts replies, files away the rest.",
    tools: ["memory_recall"],
    enabled: false,
  },
];

export default function AgentsPage() {
  return (
    <PageShell
      title="Agents"
      subtitle="Reusable AI workers with their own prompt + tool kit"
      actions={
        <Button size="sm" className="rounded-full">
          <Plus className="mr-1 h-3.5 w-3.5" /> New agent
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sampleAgents.map((a) => (
          <div
            key={a.name}
            className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.enabled ? "Active" : "Paused"}
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-foreground/70">{a.description}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {a.tools.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
