"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Megaphone, Code2, CalendarClock, LineChart } from "lucide-react";

const scenarios = [
  {
    id: "marketing",
    icon: Megaphone,
    label: "Marketing",
    title: "Launch a campaign in one message",
    you: '"Draft a 3-post launch series for our v2, schedule on X and LinkedIn for tomorrow 9am, and DM the headline to the team on Slack."',
    bot: [
      "Drafts copy for X + LinkedIn (3 variants each)",
      "Generates the cover image",
      "Schedules posts in your social tool",
      "Sends the headline to #launch on Slack",
    ],
  },
  {
    id: "coding",
    icon: Code2,
    label: "Coding",
    title: "Ship a feature without leaving chat",
    you: '"On the operon repo, add a /healthz route, write a test, push to a branch and open a PR titled \'add health probe\'."',
    bot: [
      "Reads the repo structure",
      "Writes the route and test",
      "Pushes to a new branch",
      "Opens the PR with a description",
    ],
  },
  {
    id: "scheduling",
    icon: CalendarClock,
    label: "Scheduling",
    title: "Coordinate without the back-and-forth",
    you: '"Find 30 minutes with Sara next week, send her a calendar invite and brief her with last week\'s notes."',
    bot: [
      "Reads both calendars",
      "Picks a slot, sends the invite",
      "Attaches a summary of last week's notes",
    ],
  },
  {
    id: "trading",
    icon: LineChart,
    label: "Trading",
    title: "Watch the market while you focus",
    you: '"Watch BTCUSDT — alert me on Telegram if it drops 3% in an hour, and stage a 5% buy if it does."',
    bot: [
      "Polls the market feed",
      "Sends Telegram alert on the trigger",
      "Stages the order for your approval",
    ],
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(scenarios[0].id);
  const current = scenarios.find((s) => s.id === active)!;

  return (
    <section id="how-it-works" className="border-t border-border/60 bg-muted/30 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            One sentence in. A whole workflow out.
          </h2>
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {scenarios.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
                active === id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">You say</p>
            <p className="font-heading mt-3 text-xl">{current.title}</p>
            <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-foreground/80">
              {current.you}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground/50">Operon does</p>
            <ul className="mt-3 space-y-3">
              {current.bot.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-mono font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-foreground/80">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
