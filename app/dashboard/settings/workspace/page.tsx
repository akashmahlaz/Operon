"use client";

import { useState } from "react";
import { FileText, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const workspaceFiles = [
  {
    filename: "BOOTSTRAP.md",
    description: "Main system instructions — defines core behavior",
    content: "# BOOTSTRAP\n\nYou are Operon, the user's personal AI gateway. Prefer useful action, preserve context, and route work through the right tools.",
  },
  {
    filename: "SOUL.md",
    description: "Agent identity & personality traits",
    content: "# SOUL\n\nOperon is calm, precise, proactive, and warm. It should feel like a dependable operating layer for the user's work.",
  },
  {
    filename: "USER.md",
    description: "Your preferences — how you like to work",
    content: "# USER\n\nThe user prefers rich, Brilion-style dashboard UI, Mongo-backed production paths, and complete agent follow-through.",
  },
  {
    filename: "HEARTBEAT.md",
    description: "Recurring task schedule",
    content: "# HEARTBEAT\n\nMorning briefing: 09:00. Review schedules, open tasks, connected channels, and suggested automations.",
  },
  {
    filename: "TOOLS.md",
    description: "Custom tool definitions & API instructions",
    content: "# TOOLS\n\nUse provider, integration, scheduler, session, log, upload, and channel services through Mongo-backed modules.",
  },
];

export default function WorkspaceSettingsPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function selectFile(filename: string) {
    const file = workspaceFiles.find((item) => item.filename === filename);
    setSelectedFile(filename);
    setLoading(true);
    window.setTimeout(() => {
      setFileContent(file?.content || "");
      setLoading(false);
    }, 250);
  }

  function saveFile() {
    if (!selectedFile) return;
    setSaving(true);
    window.setTimeout(() => {
      toast.success(`${selectedFile} saved`);
      setSaving(false);
    }, 400);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Workspace Files</CardTitle>
          <CardDescription className="text-xs">
            Click a file to edit. Changes affect your AI&apos;s behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {workspaceFiles.map((file) => (
            <button
              key={file.filename}
              onClick={() => selectFile(file.filename)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-accent",
                selectedFile === file.filename && "bg-accent",
              )}
            >
              <FileText className="size-4 shrink-0 text-chart-4" />
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium">{file.filename}</p>
                <p className="text-[10px] text-muted-foreground">{file.description}</p>
              </div>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-mono text-base">{selectedFile || "Select a file"}</CardTitle>
            {selectedFile && (
              <Button size="sm" onClick={saveFile} disabled={saving} className="rounded-xl">
                <Save className="mr-1.5 size-3.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {selectedFile ? (
            loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Textarea
                value={fileContent}
                onChange={(event) => setFileContent(event.target.value)}
                className="min-h-100 resize-y rounded-xl font-mono text-sm"
                placeholder="File content..."
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a file from the left to edit</p>
              <p className="mt-1 text-xs text-muted-foreground">These files define your AI agent&apos;s identity and behavior</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
