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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Operon"
      className={cn(
        "h-7 w-7 shrink-0 object-contain",
        "mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert",
        className,
      )}
    />
  );
}

// Backwards compatibility aliases
export const BrilionWordmark = OperonWordmark;
export const BrilionMark = OperonMark;
