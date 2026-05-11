import { ExternalLink } from "lucide-react";

interface SourceUrlPartProps {
  title?: string;
  url: string;
  index?: number;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SourceUrlPart({ title, url, index }: SourceUrlPartProps) {
  const host = hostnameOf(url);
  const label = title?.trim() || host;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/40 hover:text-foreground"
    >
      {typeof index === "number" && (
        <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] font-semibold tabular-nums text-muted-foreground/80 group-hover:bg-primary/15 group-hover:text-primary">
          {index}
        </span>
      )}
      <span className="min-w-0 truncate">{label}</span>
      <span className="hidden shrink-0 font-mono text-[10.5px] text-muted-foreground/60 sm:inline">
        {host}
      </span>
      <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
    </a>
  );
}

export function SourceUrlList({ sources }: { sources: { title?: string; url: string }[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
        Sources
      </div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <SourceUrlPart key={`${s.url}-${i}`} title={s.title} url={s.url} index={i + 1} />
        ))}
      </div>
    </div>
  );
}
