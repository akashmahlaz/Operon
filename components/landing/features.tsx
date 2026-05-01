import {
  Bot,
  Workflow,
  ShieldCheck,
  Plug2,
  Brain,
  Languages,
} from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "Conversational by default",
    body: "Type — or speak — what you want. Operon picks the right tools and runs the steps for you.",
  },
  {
    icon: Workflow,
    title: "Multi-step automation",
    body: "Long-running workflows with tool calls, branching and review checkpoints. Built on Vercel AI SDK streaming.",
  },
  {
    icon: Brain,
    title: "Persistent memory",
    body: "Remembers preferences, files and prior conversations across sessions and channels.",
  },
  {
    icon: Plug2,
    title: "Connect your stack",
    body: "Google, Microsoft 365, Slack, GitHub, Stripe, WhatsApp, Telegram and more — one click.",
  },
  {
    icon: Languages,
    title: "Multilingual",
    body: "Works natively in 22 Indian languages plus English, Spanish, French and German.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Self-hosted option, scoped OAuth tokens, audit logs for every tool invocation.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-t border-border/60 bg-background py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Why Operon</p>
          <h2 className="font-heading mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            One chat. All your work.
          </h2>
          <p className="mt-4 text-foreground/70">
            Replace a dozen point tools with a single AI that knows how to drive them.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/70">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
