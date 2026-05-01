"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const DEFAULT_PROMPT = `You are Operon, the user's personal AI gateway. Be concise, proactive, and prefer running tools to asking for clarification.`;

export default function PersonaSettingsPage() {
  const [aiName, setAiName] = useState("Operon");
  const [nickname, setNickname] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    toast.success("Persona updated");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>How Operon refers to itself and to you.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="aiName">AI name</Label>
            <Input id="aiName" value={aiName} onChange={(e) => setAiName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nickname">Your nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What should Operon call you?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System prompt</CardTitle>
          <CardDescription>The persona that defines Operon&apos;s behavior.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={8}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-full">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
