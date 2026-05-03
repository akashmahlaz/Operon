import { CalendarDays, Code2, Globe2, Mail, MessageCircle, PlaySquare, Share2, TrendingUp, Video, WalletCards, FileText, MonitorCheck, MessageSquare, Phone, Database, BarChart2, Users, FolderKanban, BookOpen, Workflow } from "lucide-react";
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

export const messagingServices: ServiceCardItem[] = [
  { id: "telegram", name: "Telegram", description: "Send and receive messages, manage bots, and automate Telegram channels.", icon: MessageCircle, accentClass: "bg-[#26A5E4]/10 text-[#26A5E4]", status: "available", stats: "Bot automation" },
  { id: "whatsapp", name: "WhatsApp", description: "Reply to contacts, send broadcasts, and automate customer conversations.", icon: Phone, accentClass: "bg-[#25D366]/10 text-[#25D366]", status: "available", stats: "Messaging" },
  { id: "slack", name: "Slack", description: "Post to channels, respond to mentions, and build Slack workflow automations.", icon: MessageSquare, accentClass: "bg-[#4A154B]/10 text-[#4A154B]", status: "planned", stats: "Team channels" },
  { id: "discord", name: "Discord", description: "Manage server messages, moderate channels, and respond to commands.", icon: MessageCircle, accentClass: "bg-[#5865F2]/10 text-[#5865F2]", status: "planned", stats: "Community ops" },
];

export const projectsServices: ServiceCardItem[] = [
  { id: "notion", name: "Notion", description: "Create pages, update databases, and query your Notion workspace from chat.", icon: BookOpen, accentClass: "bg-zinc-100 text-zinc-800", status: "available", stats: "Workspace pages" },
  { id: "linear", name: "Linear", description: "Create issues, update project status, and triage backlogs automatically.", icon: FolderKanban, accentClass: "bg-[#5E6AD2]/10 text-[#5E6AD2]", status: "planned", stats: "Issue tracking" },
  { id: "jira", name: "Jira", description: "Manage sprints, update tickets, and generate standup summaries.", icon: Workflow, accentClass: "bg-[#0052CC]/10 text-[#0052CC]", status: "planned", stats: "Sprint ops" },
  { id: "asana", name: "Asana", description: "Create tasks, assign work, and track project milestones from chat.", icon: FolderKanban, accentClass: "bg-[#F06A6A]/10 text-[#F06A6A]", status: "planned", stats: "Task management" },
];

export const crmServices: ServiceCardItem[] = [
  { id: "salesforce", name: "Salesforce", description: "Query leads, update opportunities, and generate pipeline summaries.", icon: BarChart2, accentClass: "bg-[#00A1E0]/10 text-[#00A1E0]", status: "available", stats: "Pipeline" },
  { id: "hubspot", name: "HubSpot", description: "Track contacts, log activities, and draft follow-up emails from chat.", icon: Users, accentClass: "bg-[#FF7A59]/10 text-[#FF7A59]", status: "planned", stats: "Contact ops" },
  { id: "airtable", name: "Airtable", description: "Query and update Airtable bases as a flexible CRM or data store.", icon: Database, accentClass: "bg-[#FCB400]/10 text-[#FCB400]", status: "planned", stats: "Database" },
  { id: "pipedrive", name: "Pipedrive", description: "Move deals through stages and get AI-written follow-up suggestions.", icon: TrendingUp, accentClass: "bg-[#172B4D]/10 text-[#172B4D]", status: "planned", stats: "Deal tracking" },
];

export const microsoftServices: ServiceCardItem[] = [
  { id: "outlook", name: "Outlook", description: "Read, triage, and draft emails across personal and work Microsoft accounts.", icon: Mail, accentClass: "bg-blue-50 text-blue-600", status: "available", stats: "Mail automation" },
  { id: "teams", name: "Teams", description: "Send messages, summarize channels, and manage meeting schedules.", icon: MessageSquare, accentClass: "bg-[#6264A7]/10 text-[#6264A7]", status: "planned", stats: "Team messaging" },
  { id: "onedrive", name: "OneDrive", description: "Search, summarize, and organize files stored in OneDrive.", icon: FileText, accentClass: "bg-sky-50 text-sky-600", status: "planned", stats: "File access" },
  { id: "azure", name: "Azure", description: "Monitor resources, check billing, and manage cloud infrastructure.", icon: MonitorCheck, accentClass: "bg-[#0078D4]/10 text-[#0078D4]", status: "planned", stats: "Cloud ops" },
];