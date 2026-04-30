import { PageShell } from "@/components/dashboard/page-shell";
import { builtInSkills } from "@/lib/skills";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function SkillsPage() {
  return (
    <PageShell
      title="Skills"
      subtitle="Composable tools your agents can call"
    >
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
              <p className="mt-1 text-sm text-muted-foreground">
                {s.description}
              </p>
            </div>
            <Switch defaultChecked={s.enabled} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
