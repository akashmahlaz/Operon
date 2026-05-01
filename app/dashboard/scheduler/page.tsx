"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function SchedulerPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Scheduler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Run tasks on a cron, in plain English
          </p>
        </div>

        <div className="mb-8 flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Calendar className="h-5 w-5" />
          </div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Natural-language cron</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Describe a job like every weekday at 9am, summarise yesterday&apos;s emails, and Operon will keep it running.
          </p>
          <p className="mt-4 rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            coming soon
          </p>
        </div>

        {/* Placeholder form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create a scheduled job</CardTitle>
            <CardDescription>Define what to run and when.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="job-name">Job name</Label>
              <Input id="job-name" placeholder="Daily summary" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-schedule">Schedule (plain English)</Label>
              <Input id="job-schedule" placeholder="Every weekday at 9am" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-prompt">Prompt</Label>
              <Textarea id="job-prompt" rows={3} placeholder="Summarise my emails from yesterday..." />
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => toast.info("Scheduler coming soon")}>
              Create job
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
