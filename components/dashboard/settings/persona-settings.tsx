"use client";

import { useState } from "react";
import { BookOpen, Palette, Save, Sparkles, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export function PersonaSettings() {
  const [saving, setSaving] = useState(false);
  const [persona, setPersona] = useState({
    aiName: "Operon",
    userNickname: "",
    communicationStyle: "balanced",
    languagePreference: "en",
    memoryEnabled: true,
    memoryDepth: "30d",
    proactiveEnabled: true,
    morningBriefing: true,
    briefingTime: "09:00",
    expressiveReplies: false,
    voiceNotes: false,
  });

  function save() {
    setSaving(true);
    window.setTimeout(() => {
      toast.success("Personalization saved");
      setSaving(false);
    }, 450);
  }

  const preview =
    persona.communicationStyle === "desi"
      ? `Hey ${persona.userNickname || "yaar"}! Main ${persona.aiName} hun. Bata kya karna hai aaj?`
      : persona.communicationStyle === "playful"
        ? `Hey ${persona.userNickname || "there"}! I'm ${persona.aiName}. What are we building today?`
        : persona.communicationStyle === "direct"
          ? `Hi ${persona.userNickname || "there"}. I'm ${persona.aiName}. What do you need?`
          : `Hello ${persona.userNickname || "there"}! I'm ${persona.aiName}. How can I help you today?`;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <p className="text-[13px] font-semibold text-primary">Your AI, Your Way</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Operon learns your name, your preferences, and how you like to communicate — then personalizes every interaction.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="size-4 text-primary" />
            <CardTitle className="text-base">Identity</CardTitle>
          </div>
          <CardDescription>How you and your AI introduce yourselves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Your AI&apos;s Name</Label>
              <Input value={persona.aiName} onChange={(event) => setPersona({ ...persona, aiName: event.target.value })} placeholder="e.g. Operon, Aria, Max" className="rounded-xl" />
              <p className="text-[11px] text-muted-foreground">What you call your AI — it introduces itself with this name.</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">What should AI call you?</Label>
              <Input value={persona.userNickname} onChange={(event) => setPersona({ ...persona, userNickname: event.target.value })} placeholder="e.g. Akash, Boss, Yaar" className="rounded-xl" />
              <p className="text-[11px] text-muted-foreground">The AI will address you by this name in every message.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <CardTitle className="text-base">Communication Style</CardTitle>
          </div>
          <CardDescription>How Operon talks to you</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Personality</Label>
              <Select value={persona.communicationStyle} onValueChange={(value) => setPersona({ ...persona, communicationStyle: value })}>
                <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="friendly">Friendly & Warm</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="direct">Direct & Concise</SelectItem>
                  <SelectItem value="playful">Playful & Fun</SelectItem>
                  <SelectItem value="desi">Desi Vibe (Hinglish)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Language</Label>
              <Select value={persona.languagePreference} onValueChange={(value) => setPersona({ ...persona, languagePreference: value })}>
                <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="hinglish">Hinglish</SelectItem>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expressive replies</Label>
              <div className="flex h-10 items-center gap-3 rounded-xl border border-input bg-background px-3">
                <Switch checked={persona.expressiveReplies} onCheckedChange={(value) => setPersona({ ...persona, expressiveReplies: value })} />
                <span className="text-sm text-muted-foreground">{persona.expressiveReplies ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/50 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                <Sparkles className="size-3 text-primary" />
              </div>
              <div className="max-w-sm rounded-xl rounded-tl-sm border border-border bg-card px-3 py-2 text-[13px] text-foreground shadow-sm">
                {preview}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <CardTitle className="text-base">Memory</CardTitle>
          </div>
          <CardDescription>How long Operon remembers past conversations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enable Long-term Memory</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Operon remembers your preferences, past tasks, and important facts</p>
            </div>
            <Switch checked={persona.memoryEnabled} onCheckedChange={(value) => setPersona({ ...persona, memoryEnabled: value })} />
          </div>
          {persona.memoryEnabled && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[{ value: "7d", label: "7 days" }, { value: "30d", label: "30 days" }, { value: "90d", label: "90 days" }, { value: "forever", label: "Forever" }].map((option) => (
                <button key={option.value} onClick={() => setPersona({ ...persona, memoryDepth: option.value })} className={persona.memoryDepth === option.value ? "rounded-xl border border-primary bg-primary/8 px-3 py-2.5 text-sm font-medium text-primary" : "rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <CardTitle className="text-base">Proactive Behavior</CardTitle>
          </div>
          <CardDescription>Operon checks in on you — without you asking</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow title="Morning Briefing on WhatsApp" description="Quick daily summary: calendar, tasks, weather, and AI suggestions" checked={persona.morningBriefing} onCheckedChange={(value) => setPersona({ ...persona, morningBriefing: value })} />
          {persona.morningBriefing && (
            <div className="flex items-center gap-3 px-4">
              <Label className="shrink-0 text-sm text-muted-foreground">Briefing time</Label>
              <Input type="time" value={persona.briefingTime} onChange={(event) => setPersona({ ...persona, briefingTime: event.target.value })} className="w-32 rounded-xl" />
            </div>
          )}
          <ToggleRow title="Proactive Suggestions" description="Operon notices patterns and suggests automation ideas proactively" checked={persona.proactiveEnabled} onCheckedChange={(value) => setPersona({ ...persona, proactiveEnabled: value })} />
          <ToggleRow title="Voice Note Support" description="Transcribe and respond to WhatsApp voice messages" checked={persona.voiceNotes} onCheckedChange={(value) => setPersona({ ...persona, voiceNotes: value })} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2 rounded-xl px-6">
          {saving ? <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Save className="size-3.5" />}
          {saving ? "Saving..." : "Save Personalization"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
