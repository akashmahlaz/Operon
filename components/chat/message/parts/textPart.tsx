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
        "max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap",
        isUser
          ? "rounded-tr-sm bg-foreground text-background"
          : "rounded-tl-sm border border-border/80 bg-card shadow-sm text-foreground",
      )}
    >
      {text}
    </div>
  );
}
