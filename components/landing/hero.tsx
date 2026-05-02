import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Background ambient gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 20%, color-mix(in oklab, var(--teal) 30%, transparent), transparent), radial-gradient(50% 40% at 80% 10%, color-mix(in oklab, var(--coral) 28%, transparent), transparent), radial-gradient(60% 50% at 50% 90%, color-mix(in oklab, var(--success) 22%, transparent), transparent)",
        }}
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center md:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-xs font-medium text-foreground/70 backdrop-blur">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          Private · Powerful · Always on
        </div>

        <h1 className="font-heading text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl">
          Automate everything
          <br className="hidden md:block" /> from one message.
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-foreground/70 md:text-xl">
          Operon connects to the tools you already use and turns natural-language
          requests into multi-step workflows — coding, marketing, scheduling, sales,
          all from a single chat.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="rounded-full px-6">
            <Link href="/dashboard/chat">
              Start for free
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-6">
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-foreground/50">
          No credit card · Free tier forever · Sign in with Google
        </p>
      </div>
    </section>
  );
}
