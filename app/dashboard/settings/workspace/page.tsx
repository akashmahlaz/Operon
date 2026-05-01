"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function WorkspaceSettingsPage() {
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    toast.success("Workspace updated");
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Files and instructions available to Operon.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Workspace directory</Label>
          <Input value="./workspace" disabled />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="instructions">Global instructions</Label>
          <Textarea
            id="instructions"
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Additional context or rules for the AI…"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="rounded-full">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
