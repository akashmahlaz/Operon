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
        "max-w-[85%] text-[13px] leading-relaxed whitespace-pre-wrap",
        isUser
          ? "rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-background"
          : "text-foreground",
      )}
    >
      {text}
    </div>
  );
}
