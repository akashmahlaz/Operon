"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Brain, MessageCircle, Palette, Save, Sparkles, Trash2, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type PersonaState = {
  aiName: string;
  userNickname: string;
  communicationStyle: string;
  languagePreference: string;
  memoryEnabled: boolean;
  memoryDepth: string;
  proactiveEnabled: boolean;
  morningBriefing: boolean;
  briefingTime: string;
  expressiveReplies: boolean;
  voiceNotes: boolean;
};

type MemoryFact = {
  id: string;
  content: string;
  kind?: string;
  importance?: number;
  source?: string;
  updatedAt: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  web: "Web Chat",
};

const DEFAULT_STATE: PersonaState = {
  aiName: "Operon",
  userNickname: "",
  communicationStyle: "balanced",
  languagePreference: "en",
  memoryEnabled: true,
  memoryDepth: "30d",
  proactiveEnabled: true,
  morningBriefing: false,
  briefingTime: "09:00",
  expressiveReplies: false,
  voiceNotes: false,
};

function importanceBadge(importance?: number) {
  if (!importance) return null;
  const colorMap: Record<number, string> = {
    5: "bg-red-500/10 text-red-600",
    4: "bg-orange-500/10 text-orange-600",
    3: "bg-yellow-500/10 text-yellow-600",
    2: "bg-blue-500/10 text-blue-600",
    1: "bg-muted text-muted-foreground",
  };
  const labels = ["", "low", "low", "medium", "high", "critical"];
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${colorMap[importance] ?? colorMap[1]}`}>
      {labels[importance] ?? importance}
    </span>
  );
}

export function PersonaSettings() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [persona, setPersona] = useState<PersonaState>(DEFAULT_STATE);
  const [channelOverrides, setChannelOverrides] = useState<Record<string, Partial<PersonaState>>>({});
  const [memories, setMemories] = useState<MemoryFact[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/persona")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.persona) return;
        setPersona({ ...DEFAULT_STATE, ...data.persona, userNickname: data.persona.userNickname ?? "" });
        setChannelOverrides((data.persona.channelOverrides as Record<string, Partial<PersonaState>>) ?? {});
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loadMemories = useCallback(() => {
    setMemoriesLoading(true);
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((data) => setMemories((data.results ?? []) as MemoryFact[]))
      .catch(() => {})
      .finally(() => setMemoriesLoading(false));
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/persona", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...persona, channelOverrides }),
      });
      if (!response.ok) throw new Error("failed");
      const data = await response.json();
      if (data?.persona) {
        setPersona({ ...DEFAULT_STATE, ...data.persona, userNickname: data.persona.userNickname ?? "" });
        setChannelOverrides((data.persona.channelOverrides as Record<string, Partial<PersonaState>>) ?? {});
      }
      toast.success("Personalization saved — takes effect on your next message");
    } catch {
      toast.error("Could not save personalization");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemory(id: string) {
    setDeletingId(id);
    try {
      const r = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("failed");
      setMemories((prev) => prev.filter((m) => m.id !== id));
      toast.success("Memory removed");
    } catch {
      toast.error("Could not remove memory");
    } finally {
      setDeletingId(null);
    }
  }

  function setChannelOverride(channel: string, field: keyof PersonaState, value: string) {
    setChannelOverrides((prev) => ({
      ...prev,
      [channel]: { ...(prev[channel] ?? {}), [field]: value },
    }));
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
          <CardDescription>How Operon talks to you — affects every reply</CardDescription>
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

      {/* Per-channel overrides */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            <CardTitle className="text-base">Per-channel Style</CardTitle>
          </div>
          <CardDescription>Override personality and language for specific channels — takes priority over global settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {["whatsapp", "telegram", "web"].map((channel) => (
            <div key={channel} className="space-y-2">
              <p className="text-sm font-medium">{CHANNEL_LABELS[channel]}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Personality override</Label>
                  <Select
                    value={channelOverrides[channel]?.communicationStyle ?? ""}
                    onValueChange={(v) => setChannelOverride(channel, "communicationStyle", v)}
                  >
                    <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Same as global" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Same as global</SelectItem>
                      <SelectItem value="friendly">Friendly & Warm</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="direct">Direct & Concise</SelectItem>
                      <SelectItem value="playful">Playful & Fun</SelectItem>
                      <SelectItem value="desi">Desi Vibe (Hinglish)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Language override</Label>
                  <Select
                    value={channelOverrides[channel]?.languagePreference ?? ""}
                    onValueChange={(v) => setChannelOverride(channel, "languagePreference", v)}
                  >
                    <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Same as global" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Same as global</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="hinglish">Hinglish</SelectItem>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Memory settings */}
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

      {/* Memory audit */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="size-4 text-primary" />
            <CardTitle className="text-base">What Operon Knows About You</CardTitle>
          </div>
          <CardDescription>Facts the AI has learned — remove anything you don&apos;t want it to remember</CardDescription>
        </CardHeader>
        <CardContent>
          {memoriesLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <span className="size-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading...
            </div>
          ) : memories.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
              No memories yet — start chatting and Operon will learn from your conversations.
            </p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-snug">{m.content}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {m.kind && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{m.kind}</Badge>}
                      {importanceBadge(m.importance)}
                      <span className="text-[10px] text-muted-foreground">{m.source === "auto" ? "auto-learned" : (m.source ?? "manual")}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    disabled={deletingId === m.id}
                    onClick={() => deleteMemory(m.id)}
                  >
                    {deletingId === m.id
                      ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
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
        <Button onClick={save} disabled={saving || loading} className="gap-2 rounded-xl px-6">
          {saving ? <span className="size-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <Save className="size-3.5" />}
          {saving ? "Saving..." : loading ? "Loading..." : "Save Personalization"}
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
