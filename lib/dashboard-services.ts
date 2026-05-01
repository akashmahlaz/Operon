import { CalendarDays, Code2, Globe2, Mail, MessageCircle, PlaySquare, Share2, TrendingUp, Video, WalletCards } from "lucide-react";
import type { ServiceCardItem } from "@/components/dashboard/service-section-page";

export const googleServices: ServiceCardItem[] = [
  { id: "gmail", name: "Gmail", description: "Read, triage, draft, and summarize email threads from chat.", icon: Mail, accentClass: "bg-red-50 text-red-600", status: "available", stats: "Mail automation" },
  { id: "calendar", name: "Calendar", description: "Schedule meetings, inspect availability, and prepare daily agendas.", icon: CalendarDays, accentClass: "bg-blue-50 text-blue-600", status: "available", stats: "Scheduling" },
  { id: "meet", name: "Meet", description: "Create meeting links and prepare follow-up notes for calls.", icon: Video, accentClass: "bg-emerald-50 text-emerald-600", status: "planned", stats: "Meeting workflows" },
  { id: "youtube", name: "YouTube", description: "Draft metadata, publish summaries, and manage video workflows.", icon: PlaySquare, accentClass: "bg-rose-50 text-rose-600", status: "planned", stats: "Creator ops" },
];

export const socialServices: ServiceCardItem[] = [
  { id: "instagram", name: "Instagram", description: "Plan posts, generate captions, and monitor inbound messages.", icon: Share2, accentClass: "bg-pink-50 text-pink-600", status: "available", stats: "Publishing" },
  { id: "linkedin", name: "LinkedIn", description: "Draft founder posts, repurpose blogs, and track campaign ideas.", icon: Share2, accentClass: "bg-sky-50 text-sky-600", status: "available", stats: "Professional content" },
  { id: "x", name: "X / Twitter", description: "Build threads, schedule updates, and summarize audience replies.", icon: MessageCircle, accentClass: "bg-zinc-100 text-zinc-700", status: "planned", stats: "Social listening" },
  { id: "facebook", name: "Facebook", description: "Manage page content, comments, and cross-post campaigns.", icon: Globe2, accentClass: "bg-blue-50 text-blue-600", status: "planned", stats: "Page ops" },
];

export const tradingServices: ServiceCardItem[] = [
  { id: "binance", name: "Binance", description: "Review balances, summarize positions, and prepare trade workflows.", icon: TrendingUp, accentClass: "bg-yellow-50 text-yellow-700", status: "planned", stats: "Crypto workflows" },
  { id: "zerodha", name: "Zerodha", description: "Track Indian market watchlists and generate portfolio summaries.", icon: WalletCards, accentClass: "bg-emerald-50 text-emerald-600", status: "planned", stats: "Brokerage" },
  { id: "coinbase", name: "Coinbase", description: "Monitor assets, create alerts, and explain market moves.", icon: TrendingUp, accentClass: "bg-blue-50 text-blue-600", status: "planned", stats: "Exchange" },
];

export const codingServices: ServiceCardItem[] = [
  { id: "github", name: "GitHub", description: "Open issues, inspect pull requests, and ask Operon to review code.", icon: Code2, accentClass: "bg-zinc-100 text-zinc-800", status: "available", stats: "Repos and PRs" },
  { id: "vercel", name: "Vercel", description: "Check deployments, diagnose build logs, and coordinate releases.", icon: Globe2, accentClass: "bg-neutral-100 text-neutral-800", status: "available", stats: "Deployments" },
  { id: "cloudflare", name: "Cloudflare", description: "Manage DNS, workers, and edge application health.", icon: Code2, accentClass: "bg-orange-50 text-orange-600", status: "planned", stats: "Edge ops" },
];