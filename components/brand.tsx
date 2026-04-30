import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrilionWordmark({
  className,
  height = 18,
}: {
  className?: string;
  height?: number;
}) {
  // Aspect ratio of the source SVG is ~718:204
  const width = Math.round((height * 718) / 204);
  return (
    <Image
      src="/brilion-wordmark.svg"
      alt="Brilion"
      width={width}
      height={height}
      priority
      className={cn("h-[18px] w-auto select-none", className)}
    />
  );
}

export function BrilionMark({ className }: { className?: string }) {
  // Compact diamond mark used in tight spaces (sidebar collapsed, favicon-ish)
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2 L22 12 L12 22 L2 12 Z" />
        <path d="M12 7 L17 12 L12 17 L7 12 Z" />
      </svg>
    </span>
  );
}
