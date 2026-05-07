import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    cadence: "forever",
    blurb: "For exploring and personal projects.",
    features: ["100 messages / day", "5 connected tools", "Web channel only", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹1,999",
    cadence: "/ month",
    blurb: "For power users who run their day from chat.",
    features: [
      "Unlimited messages",
      "All integrations",
      "WhatsApp + Telegram channels",
      "Memory across sessions",
      "Priority support",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Team",
    price: "₹4,999",
    cadence: "/ month",
    blurb: "Shared workspace for small teams.",
    features: ["Everything in Pro", "Up to 5 seats", "Shared agents & skills", "Audit log", "SSO"],
    cta: "Talk to us",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-t border-border/60 bg-background py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Pricing</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            Simple plans. Cancel anytime.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7 transition-shadow",
                t.highlight
                  ? "border-foreground bg-foreground text-background shadow-xl"
                  : "border-border bg-card",
              )}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="font-heading text-xl font-semibold">{t.name}</h3>
              <p className={cn("mt-1 text-sm", t.highlight ? "text-background/70" : "text-foreground/60")}>
                {t.blurb}
              </p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-semibold">{t.price}</span>
                <span className={cn("text-sm", t.highlight ? "text-background/60" : "text-foreground/60")}>
                  {t.cadence}
                </span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={cn("mt-0.5 h-4 w-4 shrink-0", t.highlight ? "text-background" : "text-primary")} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={cn(
                  "mt-8 rounded-full",
                  t.highlight && "bg-background text-foreground hover:bg-background/90",
                )}
                variant={t.highlight ? "default" : "outline"}
              >
                <Link href="/dashboard/chat">{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
