import { cn } from "@/lib/utils";

interface ReasoningPartProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function ReasoningPart({ text, streaming, className }: ReasoningPartProps) {
  if (!text && !streaming) return null;

  return (
    <div
      className={cn(
        "border-l-2 border-border/70 pl-3 text-xs italic leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {text && <span className="whitespace-pre-wrap">{text}</span>}
      {streaming && <span className="ml-0.5 inline-block animate-pulse text-foreground">|</span>}
    </div>
  );
}
