import { PageShell, ComingSoon } from "@/components/dashboard/page-shell";
import { Calendar } from "lucide-react";

export default function SchedulerPage() {
  return (
    <PageShell title="Scheduler" subtitle="Run tasks on a cron, in plain English">
      <ComingSoon
        title="Natural-language cron"
        description={`Describe a job — "every weekday at 9am, summarise yesterday's emails" — and Brilion will keep it running.`}
        icon={Calendar}
      />
    </PageShell>
  );
}
