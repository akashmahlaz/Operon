"use client";

import { ProviderIcon as LobeProviderIcon } from "@lobehub/icons";
import { Bot, Cloud, Code2, Globe2, Search, Sparkles, Triangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const providerClass: Record<string, string> = {
  "github-copilot": "bg-zinc-950 text-white",
  github: "bg-zinc-950 text-white",
  openai: "bg-emerald-950 text-emerald-100",
  anthropic: "bg-orange-100 text-orange-700",
  openrouter: "bg-blue-950 text-blue-100",
  google: "bg-blue-100 text-blue-700",
  qwen: "bg-violet-100 text-violet-700",
  xai: "bg-zinc-100 text-zinc-800",
  mistral: "bg-amber-100 text-amber-700",
  groq: "bg-rose-100 text-rose-700",
  deepseek: "bg-cyan-100 text-cyan-700",
  minimax: "bg-primary/10 text-primary",
  tavily: "bg-sky-100 text-sky-700",
  vercel: "bg-neutral-950 text-white",
  netlify: "bg-teal-100 text-teal-700",
};

export function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const lobeProvider = provider === "github-copilot" ? "githubcopilot" : provider;
  const hasLobeIcon = !["maton", "akash"].includes(provider);

  if (hasLobeIcon) {
    return (
      <span className={cn("inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background", className)}>
        <LobeProviderIcon provider={lobeProvider} size={22} type="color" />
      </span>
    );
  }

  const Icon =
    provider.includes("github") ? Code2
    : provider === "vercel" ? Triangle
    : provider === "tavily" || provider === "perplexity" ? Search
    : provider === "cloudflare" ? Cloud
    : provider === "netlify" ? Globe2
    : provider === "qwen" || provider === "deepseek" || provider === "mistral" ? Bot
    : provider === "replicate" || provider === "fireworks" ? Code2
    : provider === "groq" || provider === "xai" ? Zap
    : Sparkles;

  return (
    <span className={cn("inline-flex size-8 items-center justify-center rounded-lg", providerClass[provider] ?? "bg-muted text-foreground", className)}>
      <Icon className="size-4" />
    </span>
  );
}
