"use client";

import Link from "next/link";
import { useState } from "react";
import { BrilionWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { marketingNav } from "@/lib/nav";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MarketingNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrilionWordmark height={16} />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-foreground/70 transition-colors hover:text-foreground"
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/chat">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/dashboard/chat">Start free</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border md:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <div
        className={cn(
          "border-t border-border/60 bg-background md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
          {marketingNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-sm text-foreground/80 hover:bg-muted"
            >
              {item.title}
            </Link>
          ))}
          <div className="mt-2 flex gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link href="/dashboard/chat">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="flex-1 rounded-full">
              <Link href="/dashboard/chat">Start free</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
