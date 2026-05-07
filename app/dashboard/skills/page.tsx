"use client";

import { builtInSkills } from "@/lib/skills";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function SkillsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Skills</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Composable tools your agents can call
          </p>
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
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.description}
                </p>
              </div>
              <Switch defaultChecked={s.enabled} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
