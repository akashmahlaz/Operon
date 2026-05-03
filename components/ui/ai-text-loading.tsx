"use client";

/**
 * Adapted from kokonutui (https://kokonutui.com) — MIT.
 * Cycling shimmer text for AI loading states.
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AITextLoadingProps {
  texts?: string[];
  className?: string;
  interval?: number;
}

export function AITextLoading({
  texts = [
    "Thinking…",
    "Processing…",
    "Analyzing…",
    "Computing…",
    "Almost there…",
  ],
  className,
  interval = 1500,
}: AITextLoadingProps) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setI((x) => (x + 1) % texts.length);
    }, interval);
    return () => clearInterval(t);
  }, [interval, texts.length]);

  return (
    <div className="flex items-center justify-center p-6">
      <motion.div
        animate={{ opacity: 1 }}
        className="relative w-full px-2 py-1"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            animate={{
              opacity: 1,
              y: 0,
              backgroundPosition: ["200% center", "-200% center"],
            }}
            className={cn(
              "flex min-w-max justify-center whitespace-nowrap bg-size-[200%_100%] bg-linear-to-r from-neutral-950 via-neutral-400 to-neutral-950 bg-clip-text font-bold text-2xl text-transparent dark:from-white dark:via-neutral-600 dark:to-white",
              className
            )}
            exit={{ opacity: 0, y: -16 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{
              opacity: { duration: 0.3 },
              y: { duration: 0.3 },
              backgroundPosition: {
                duration: 2.5,
                ease: "linear",
                repeat: Number.POSITIVE_INFINITY,
              },
            }}
          >
            {texts[i]}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default AITextLoading;
