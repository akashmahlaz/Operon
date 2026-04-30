// User-side text bubble vs assistant-side: kept minimal & on-brand.

import { cn } from "@/lib/utils";

export default function TextPart({
  text,
  isUser,
}: {
  text: string;
  isUser: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "rounded-tr-sm bg-primary text-primary-foreground"
          : "rounded-tl-sm border border-border bg-card text-foreground",
      )}
    >
      {text}
    </div>
  );
}
