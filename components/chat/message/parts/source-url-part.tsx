import { ExternalLink } from "lucide-react";

interface SourceUrlPartProps {
  title?: string;
  url: string;
}

export function SourceUrlPart({ title, url }: SourceUrlPartProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <ExternalLink className="size-3" />
      <span className="truncate">{title || url}</span>
    </a>
  );
}
