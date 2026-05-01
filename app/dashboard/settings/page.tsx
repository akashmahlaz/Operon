"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, FileText, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "User",
    email: "",
    model: "MiniMax-M2.7",
    apiKey: "",
    systemPrompt: `You are Operon, the user's personal AI gateway. Be concise, proactive, and prefer running tools to asking for clarification.`,
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    toast.success("Settings saved");
    setSaving(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage providers, workspace, and your AI persona
          </p>
        </div>

        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="mb-6 grid w-full grid-cols-3">
            <TabsTrigger value="providers" className="gap-2">
              <ShieldCheck className="size-4" /> Providers
            </TabsTrigger>
            <TabsTrigger value="workspace" className="gap-2">
              <FileText className="size-4" /> Workspace
            </TabsTrigger>
            <TabsTrigger value="persona" className="gap-2">
              <Sparkles className="size-4" /> Persona
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers">
            <Card>
              <CardHeader>
                <CardTitle>AI Provider</CardTitle>
                <CardDescription>Configure the AI model used for chat and agents.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="MiniMax-M2.7"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="sk-…"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workspace">
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
                    rows={4}
                    placeholder="Additional context or rules for the AI..."
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="persona">
            <Card>
              <CardHeader>
                <CardTitle>AI Persona</CardTitle>
                <CardDescription>The system prompt that defines Operon&apos;s behavior.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={8}
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="rounded-full">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
