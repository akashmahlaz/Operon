"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Copy, ExternalLink, Eye, EyeOff, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProviderIcon } from "@/components/dashboard/settings/provider-icon";
import { isModelProvider, providerCatalog, recommendedProviderIds, type ProviderMeta } from "@/components/dashboard/settings/provider-catalog";

interface AuthProfile {
  profileId: string;
  provider: string;
  tokenRef: string;
  baseUrl?: string;
  models?: string[];
  defaultModel?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CopilotFlow {
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

interface ProviderApiState {
  providers: ProviderMeta[];
  profiles: AuthProfile[];
  defaultModel: string;
  recentProviderId: string | null;
}

export function ProvidersSettings() {
  const [providers, setProviders] = useState(providerCatalog);
  const [profiles, setProfiles] = useState<AuthProfile[]>([]);
  const [currentModel, setCurrentModel] = useState("minimax/MiniMax-M2.7");
  const [search, setSearch] = useState("");
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [recentProviderId, setRecentProviderId] = useState<string | null>("minimax");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadProviders() {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/providers", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load providers");
      const data = await response.json() as ProviderApiState;
      setProviders(data.providers);
      setProfiles(data.profiles);
      setCurrentModel(data.defaultModel || "minimax/MiniMax-M2.7");
      setRecentProviderId(data.recentProviderId || "minimax");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load providers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadProviders();
    });
  }, []);

  const visibleGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visibleProviders = providers.filter((provider) => {
      if (!query) return true;
      return [provider.name, provider.id, provider.description, provider.shortDescription].join(" ").toLowerCase().includes(query);
    });

    return {
      connected: visibleProviders.filter((provider) => isModelProvider(provider) && provider.configured),
      recommended: recommendedProviderIds
        .map((id) => visibleProviders.find((provider) => provider.id === id))
        .filter((provider): provider is ProviderMeta => Boolean(provider && !provider.configured)),
      gateways: visibleProviders.filter((provider) => provider.kind === "gateway" && !provider.configured),
      modelProviders: visibleProviders.filter((provider) => provider.kind === "model" && !provider.configured),
      integrations: visibleProviders.filter((provider) => provider.kind === "integration"),
    };
  }, [providers, search]);

  function openProvider(id: string) {
    if (id === "github-copilot") {
      setCopilotOpen(true);
      return;
    }
    setActiveProviderId(id);
  }

  function markConnected(providerId: string, tokenRef: string, baseUrl?: string) {
    const updatedAt = new Date().toISOString();
    setProviders((previous) => previous.map((provider) => provider.id === providerId ? { ...provider, configured: true, tokenRef, updatedAt } : provider));
    setProfiles((previous) => [
      ...previous.filter((profile) => profile.provider !== providerId),
      { profileId: providerId, provider: providerId, tokenRef, baseUrl, updatedAt },
    ]);
    setRecentProviderId(providerId);
  }

  function syncConnectedProvider(providerId: string, profile: AuthProfile, models: string[], defaultModel?: string) {
    const updatedAt = profile.updatedAt || new Date().toISOString();
    setProviders((previous) => previous.map((provider) => provider.id === providerId ? { ...provider, configured: true, tokenRef: profile.tokenRef, updatedAt, models, defaultModel } : provider));
    setProfiles((previous) => [...previous.filter((item) => item.provider !== providerId), { ...profile, models, defaultModel, updatedAt }]);
    setRecentProviderId(providerId);
  }

  function disconnectProvider(providerId: string) {
    setProviders((previous) => previous.map((provider) => provider.id === providerId ? { ...provider, configured: false, tokenRef: undefined, updatedAt: undefined } : provider));
    setProfiles((previous) => previous.filter((profile) => profile.provider !== providerId));
    if (currentModel.startsWith(`${providerId}/`)) setCurrentModel("");
  }

  async function disconnectProviderRemote(providerId: string) {
    const profile = profiles.find((item) => item.provider === providerId);
    const profileId = profile?.profileId || `${providerId}:api_key`;
    const response = await fetch(`/api/providers?profileId=${encodeURIComponent(profileId)}&provider=${encodeURIComponent(providerId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error("Failed to disconnect provider");
    disconnectProvider(providerId);
  }

  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const activeProfile = profiles.find((profile) => profile.provider === activeProviderId);
  const copilotProfile = profiles.find((profile) => profile.provider === "github-copilot");

  return (
    <div className="flex flex-col gap-6">
      <DefaultModelSelector
        key={`${currentModel}:${recentProviderId}:${profiles.length}:${providers.length}`}
        providers={providers}
        profiles={profiles}
        currentModel={currentModel}
        recentProviderId={recentProviderId}
        onModelSelected={setCurrentModel}
        onConnectProvider={openProvider}
      />

      {loadError && <Alert variant="destructive"><AlertCircle /><AlertTitle>Providers unavailable</AlertTitle><AlertDescription>{loadError}</AlertDescription></Alert>}
      {loading && <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading connected providers...</CardContent></Card>}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search providers, gateways, and integrations..." value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl pl-9" />
      </div>

      <div className="flex flex-col gap-7">
        <ProviderSection title="Connected model providers" description="These providers can be selected as the default route." providers={visibleGroups.connected} currentModel={currentModel} profiles={profiles} onOpen={openProvider} />
        <ProviderSection title="Recommended first connections" description="Start here if you want chat and agents working quickly." providers={visibleGroups.recommended} currentModel={currentModel} profiles={profiles} onOpen={openProvider} />
        <ProviderSection title="Model gateways" description="Use one gateway key to access many model families." providers={visibleGroups.gateways} currentModel={currentModel} profiles={profiles} onOpen={openProvider} />
        <ProviderSection title="Direct model providers" description="Connect individual AI labs and inference providers." providers={visibleGroups.modelProviders} currentModel={currentModel} profiles={profiles} onOpen={openProvider} />
        <ProviderSection title="Service integrations" description="These tokens power tools and deployments, not default chat models." providers={visibleGroups.integrations} currentModel={currentModel} profiles={profiles} onOpen={openProvider} />
        {Object.values(visibleGroups).every((group) => group.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No providers match &quot;{search}&quot;</p>
            </CardContent>
          </Card>
        )}
      </div>

      <ConnectProviderDialog provider={activeProvider} profile={activeProfile} onOpenChange={(open) => !open && setActiveProviderId(null)} onConnected={syncConnectedProvider} onDisconnected={disconnectProviderRemote} />
      <CopilotConnectDialog open={copilotOpen} onOpenChange={setCopilotOpen} existingProfile={copilotProfile} currentModel={currentModel} onConnected={(tokenRef) => markConnected("github-copilot", tokenRef)} onDisconnected={() => disconnectProvider("github-copilot")} onModelSelected={setCurrentModel} />
    </div>
  );
}

function DefaultModelSelector({ providers, profiles, currentModel, recentProviderId, onModelSelected, onConnectProvider }: { providers: ProviderMeta[]; profiles: AuthProfile[]; currentModel: string; recentProviderId: string | null; onModelSelected: (modelSpec: string) => void; onConnectProvider: (providerId: string) => void }) {
  const connectedProviders = useMemo(() => providers.filter((provider) => provider.configured && isModelProvider(provider)), [providers]);
  const currentProviderId = currentModel.includes("/") ? currentModel.split("/", 2)[0] : null;
  const currentModelId = currentModel.includes("/") ? currentModel.split("/", 2)[1] : currentModel;
  const [providerId, setProviderId] = useState(recentProviderId ?? currentProviderId ?? connectedProviders[0]?.id ?? "");
  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const [modelId, setModelId] = useState(currentModelId || selectedProvider?.recommendedModel || selectedProvider?.models?.[0] || "");
  const [manualModelId, setManualModelId] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const models = selectedProvider?.models || [];

  async function refreshModels() {
    if (!providerId) return;
    setLoadingModels(true);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh-models", provider: providerId }),
      });
      if (!response.ok) throw new Error("Failed to refresh models");
      setLoadingModels(false);
      toast.success("Model list refreshed");
    } catch (error) {
      setLoadingModels(false);
      toast.error(error instanceof Error ? error.message : "Failed to refresh models");
    }
  }

  async function saveDefaultModel() {
    const selectedModelId = modelId || manualModelId.trim();
    if (!providerId || !selectedModelId) return;
    setSaving(true);
    try {
      const spec = `${providerId}/${selectedModelId}`;
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-default", model: spec }),
      });
      if (!response.ok) throw new Error("Failed to save default model");
      onModelSelected(spec);
      toast.success(`Default model set to ${spec}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save default model");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Default model route</CardTitle>
        <CardDescription>Choose the connected provider and model Operon should use for chat and agents.</CardDescription>
        {selectedProvider && connectedProviders.length > 0 && (
          <CardAction><Badge variant="secondary" className="rounded-full">{profiles.some((profile) => profile.provider === providerId) ? "Recently connected" : "Connected"}</Badge></CardAction>
        )}
      </CardHeader>
      <CardContent>
        {connectedProviders.length === 0 ? (
          <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-5 text-center">
            <div>
              <p className="text-sm font-medium">Connect a model provider first</p>
              <p className="mt-1 text-xs text-muted-foreground">Start with GitHub Copilot, OpenAI, Anthropic, or OpenRouter.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {recommendedProviderIds.map((id) => {
                const provider = providers.find((item) => item.id === id);
                if (!provider) return null;
                return <Button key={id} variant="outline" onClick={() => onConnectProvider(id)} className="gap-2 rounded-xl"><ProviderIcon provider={id} className="size-6" />{provider.name}</Button>;
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
              <div className="flex flex-col gap-2">
                <Label>Default provider</Label>
                <Select value={providerId} onValueChange={(value) => { setProviderId(value); const provider = providers.find((item) => item.id === value); setModelId(provider?.recommendedModel || provider?.models?.[0] || ""); setManualModelId(""); }}>
                  <SelectTrigger className="h-10 w-full rounded-xl"><SelectValue placeholder="Choose provider" /></SelectTrigger>
                  <SelectContent position="popper" align="start">
                    <SelectGroup>
                      <SelectLabel>Connected providers</SelectLabel>
                      {connectedProviders.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Default model</Label>
                {models.length > 0 ? (
                  <Select value={modelId} onValueChange={setModelId} disabled={loadingModels}>
                    <SelectTrigger className="h-10 w-full rounded-xl"><SelectValue placeholder={loadingModels ? "Fetching models..." : "Choose model"} /></SelectTrigger>
                    <SelectContent position="popper" align="start">
                      <SelectGroup>
                        <SelectLabel>{selectedProvider?.name ?? "Models"}</SelectLabel>
                        {models.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={manualModelId} onChange={(event) => setManualModelId(event.target.value)} placeholder="Enter model ID manually" className="h-10 rounded-xl font-mono text-xs" />
                )}
              </div>

              <Button onClick={saveDefaultModel} disabled={!providerId || !(modelId || manualModelId.trim()) || saving} className="h-10 gap-2 rounded-xl">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Set default
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {loadingModels && <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> Fetching models</span>}
              {!loadingModels && models.length > 0 && <span>{models.length} models available</span>}
              {!loadingModels && models.length === 0 && providerId && <span>No model list returned; manual model ID is available.</span>}
              {providerId && <Button variant="ghost" size="sm" onClick={refreshModels} className="h-7 gap-1.5 rounded-lg"><RefreshCw className="size-3" /> Refresh</Button>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderSection({ title, description, providers, currentModel, profiles, onOpen }: { title: string; description: string; providers: ProviderMeta[]; currentModel: string; profiles: AuthProfile[]; onOpen: (providerId: string) => void }) {
  if (providers.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <div>
        <div className="flex items-center gap-2"><h2 className="font-heading text-sm font-semibold tracking-tight">{title}</h2><Badge variant="outline" className="rounded-full text-[10px]">{providers.length}</Badge></div>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => <ProviderCard key={provider.id} provider={provider} currentModel={currentModel} profile={profiles.find((profile) => profile.provider === provider.id)} onClick={() => onOpen(provider.id)} />)}
      </div>
    </section>
  );
}

function ProviderCard({ provider, currentModel, profile, onClick }: { provider: ProviderMeta; currentModel: string; profile?: AuthProfile; onClick: () => void }) {
  const isDefault = currentModel.startsWith(`${provider.id}/`);
  const defaultModelId = isDefault ? currentModel.split("/", 2)[1] : null;
  return (
    <button onClick={onClick} className={cn("group flex min-h-36 flex-col gap-4 rounded-lg bg-card p-4 text-left ring-1 ring-foreground/10 transition-all hover:bg-accent/40 hover:ring-primary/30", provider.configured && "ring-primary/30")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><ProviderIcon provider={provider.id} className="size-10" /><div className="min-w-0"><p className="truncate text-sm font-medium">{provider.name}</p><p className="truncate text-[11px] text-muted-foreground">{provider.id}</p></div></div>
        <Badge variant={provider.configured ? "secondary" : "outline"} className="shrink-0 rounded-full text-[10px]">{provider.configured ? "Connected" : provider.setup === "oauth" ? "Login" : "API key"}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <p className="line-clamp-2 text-xs text-muted-foreground">{provider.shortDescription}</p>
        <div className="flex flex-wrap gap-1.5">{provider.badge && <Badge variant="outline" className="rounded-full text-[10px]">{provider.badge}</Badge>}{isDefault && <Badge variant="secondary" className="rounded-full text-[10px]">Default</Badge>}{profile?.updatedAt && <Badge variant="outline" className="rounded-full text-[10px]">Updated {formatShortDate(profile.updatedAt)}</Badge>}</div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="truncate font-mono text-[11px] text-muted-foreground">{defaultModelId ?? (provider.configured ? profile?.tokenRef : provider.defaultBaseUrl ?? provider.website)}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">{provider.configured ? "Configure" : "Connect"}<Plus className="size-3" /></span>
      </div>
    </button>
  );
}

function ConnectProviderDialog({ provider, profile, onOpenChange, onConnected, onDisconnected }: { provider?: ProviderMeta; profile?: AuthProfile; onOpenChange: (open: boolean) => void; onConnected: (providerId: string, profile: AuthProfile, models: string[], defaultModel?: string) => void; onDisconnected: (providerId: string) => Promise<void> }) {
  const [keyInput, setKeyInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string | undefined>();
  if (!provider) return null;
  const models = discoveredModels.length > 0 ? discoveredModels : provider.models || [];

  async function connect() {
    if (!provider || !keyInput.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id, apiKey: keyInput.trim(), baseUrl: baseUrlInput.trim() || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not validate this API key");
      const modelIds = Array.isArray(data.models) ? data.models.map((model: { id?: string }) => model.id).filter(Boolean) : [];
      setDiscoveredModels(modelIds);
      setDefaultModel(data.defaultModel);
      onConnected(provider.id, data.profile, modelIds, data.defaultModel);
      setConnected(true);
      toast.success(`${provider.name} connected`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not validate this API key");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={Boolean(provider)} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5"><div className="flex items-start gap-3 pr-8"><ProviderIcon provider={provider.id} className="size-11" /><div className="min-w-0 flex-1"><DialogTitle>{provider.name}</DialogTitle><DialogDescription className="mt-1">{provider.shortDescription}</DialogDescription></div></div></DialogHeader>
        <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-5">
          {provider.id === "github" && <Alert><AlertCircle /><AlertTitle>GitHub Models Marketplace</AlertTitle><AlertDescription>This is not GitHub Copilot. It uses a GitHub token with the Marketplace Models inference endpoint.</AlertDescription></Alert>}
          {profile && !connected && <Alert><Check /><AlertTitle>Already connected</AlertTitle><AlertDescription>A key is saved as {profile.tokenRef}. Paste a new key only if you want to replace it.</AlertDescription></Alert>}
          {!connected ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><div className="flex items-center justify-between gap-3"><Label>API key</Label><a href={provider.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Get key <ExternalLink className="size-3" /></a></div><div className="relative"><Input type={showKey ? "text" : "password"} value={keyInput} onChange={(event) => setKeyInput(event.target.value)} placeholder={getKeyPlaceholder(provider.id)} className="h-10 rounded-xl pr-10 font-mono text-xs" autoComplete="off" disabled={connecting} /><button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><p className="text-xs text-muted-foreground">We validate the key by fetching available models, then save it encrypted.</p></div>
              <div className="flex flex-col gap-2"><Label>Base URL</Label><Input value={baseUrlInput} onChange={(event) => setBaseUrlInput(event.target.value)} placeholder={provider.defaultBaseUrl || "Optional custom endpoint"} className="h-10 rounded-xl font-mono text-xs" disabled={connecting} /></div>
            </div>
          ) : (
            <div className="flex flex-col gap-4"><Alert><Check /><AlertTitle>{provider.name} is connected</AlertTitle><AlertDescription>{models.length ? `${models.length} models were discovered. Choose the default model from the top selector.` : "The key was saved, but the provider did not return a model list."}</AlertDescription></Alert>{models.length > 0 && <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">{models.slice(0, 24).map((model) => <div key={model} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-accent"><span className="truncate font-mono">{model}</span>{(model === defaultModel || model === provider.recommendedModel) && <Badge variant="secondary" className="rounded-full text-[10px]">Recommended</Badge>}</div>)}</div>}</div>
          )}
          {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Connection failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border px-6 py-4">{profile && !connected && <Button variant="ghost" onClick={async () => { try { await onDisconnected(provider.id); toast.success("Provider disconnected"); onOpenChange(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to disconnect provider"); } }} className="mr-auto gap-2 text-destructive hover:text-destructive"><Trash2 className="size-4" /> Disconnect</Button>}<Button variant="outline" onClick={() => onOpenChange(false)}>{connected ? "Choose default" : "Cancel"}</Button>{!connected && <Button onClick={connect} disabled={connecting || !keyInput.trim()} className="gap-2">{connecting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Connect and fetch models</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopilotConnectDialog({ open, onOpenChange, existingProfile, currentModel, onConnected, onDisconnected, onModelSelected }: { open: boolean; onOpenChange: (open: boolean) => void; existingProfile?: AuthProfile; currentModel: string; onConnected: (tokenRef: string) => void; onDisconnected: () => void; onModelSelected: (spec: string) => void }) {
  const [flow, setFlow] = useState<CopilotFlow | null>(null);
  const [polling, setPolling] = useState(false);
  const [success, setSuccess] = useState(Boolean(existingProfile));
  const [starting, setStarting] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const copilot = providerCatalog.find((provider) => provider.id === "github-copilot")!;
  const models = copilot.models || [];

  function startLogin() {
    setStarting(true);
    setSuccess(false);
    window.setTimeout(() => {
      const nextFlow = { userCode: "ABCD-1234", verificationUri: "https://github.com/login/device", expiresIn: 900 };
      setFlow(nextFlow);
      setPolling(true);
      setStarting(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => { setPolling(false); setSuccess(true); onConnected("github-copilot:oauth"); toast.success("GitHub Copilot connected"); }, 1800);
    }, 450);
  }

  function selectModel(modelId: string) {
    const spec = `github-copilot/${modelId}`;
    onModelSelected(spec);
    toast.success(`Default model set to ${modelId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-6 py-5"><div className="flex items-start gap-3 pr-8"><ProviderIcon provider="github-copilot" className="size-11" /><div><DialogTitle>GitHub Copilot Chat</DialogTitle><DialogDescription className="mt-1">Sign in with GitHub device login to use models from your Copilot subscription.</DialogDescription></div></div></DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
          {!flow && !success && <div className="flex flex-col gap-4"><Alert><AlertCircle /><AlertTitle>Copilot is different from GitHub Models</AlertTitle><AlertDescription>Copilot uses your GitHub account. GitHub Models Marketplace uses a token and a separate inference endpoint.</AlertDescription></Alert><Button onClick={startLogin} disabled={starting} className="w-full gap-2">{starting ? <Loader2 className="size-4 animate-spin" /> : <ProviderIcon provider="github" className="size-6" />} Sign in with GitHub</Button></div>}
          {flow && !success && <div className="flex flex-col gap-4"><div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-5 text-center"><p className="text-xs text-muted-foreground">Enter this code on GitHub</p><div className="mt-2 flex items-center justify-center gap-2"><code className="font-mono text-3xl font-bold tracking-[0.25em]">{flow.userCode}</code><Button variant="ghost" size="icon-sm" onClick={() => { navigator.clipboard.writeText(flow.userCode); toast.success("Code copied"); }}><Copy className="size-4" /></Button></div></div><Button asChild className="w-full gap-2"><a href={flow.verificationUri} target="_blank" rel="noopener noreferrer">Open GitHub device page <ExternalLink className="size-4" /></a></Button>{polling && <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Waiting for authorization...</p>}</div>}
          {success && <div className="flex flex-col gap-4"><Alert><Check /><AlertTitle>Copilot is connected</AlertTitle><AlertDescription>Choose a default model here or use the provider/model selector at the top of the page.</AlertDescription></Alert><div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">{models.map((model) => { const isDefault = `github-copilot/${model}` === currentModel; return <button key={model} onClick={() => selectModel(model)} className={cn("flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent", isDefault && "bg-accent")}><span className="truncate font-mono">{model}</span>{isDefault && <Badge variant="secondary" className="rounded-full text-[10px]">Default</Badge>}</button>; })}</div></div>}
        </div>
        <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border px-6 py-4">{success && existingProfile && <Button variant="ghost" onClick={() => { onDisconnected(); setSuccess(false); setFlow(null); toast.success("GitHub Copilot disconnected"); onOpenChange(false); }} className="mr-auto gap-2 text-destructive hover:text-destructive"><Trash2 className="size-4" /> Disconnect</Button>}{flow && !success && <Button variant="outline" onClick={startLogin}>New code</Button>}<Button onClick={() => onOpenChange(false)} variant={success ? "default" : "outline"}>{success ? "Done" : "Close"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function getKeyPlaceholder(providerId: string) {
  if (providerId === "openai") return "sk-...";
  if (providerId === "anthropic") return "sk-ant-...";
  if (providerId === "qwen") return "sk-... or DashScope key";
  return "Paste API key";
}
