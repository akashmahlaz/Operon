import { cn } from "@/lib/utils";

export function OperonWordmark({
  className,
  height = 18,
}: {
  className?: string;
  height?: number;
}) {
  // Inline SVG wordmark for Operon - avoids external file dependency
  return (
    <svg
      viewBox="0 0 120 32"
      fill="none"
      className={cn("select-none", className)}
      style={{ height, width: "auto" }}
      aria-label="Operon"
    >
      <text
        x="0"
        y="24"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="26"
        fontWeight="700"
        fill="currentColor"
      >
        Operon
      </text>
    </svg>
  );
}

export function OperonMark({ className }: { className?: string }) {
  // Compact diamond/O mark used in tight spaces (sidebar collapsed, favicon-ish)
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg bg-foreground text-background",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7 L15 12 L12 17 L9 12 Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

// Backwards compatibility aliases
export const BrilionWordmark = OperonWordmark;
export const BrilionMark = OperonMark;
