"use client";

import { useState } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface TextPartProps {
  text: string;
  isUser?: boolean;
  streaming?: boolean;
}

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = (className?.match(/language-([\w-]+)/)?.[1] ?? "").toLowerCase();
  const raw = String(children ?? "").replace(/\n$/, "");

  return (
    <div className="group/code relative my-2 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/80">
        <span>{lang || "code"}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(raw);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground/90">
        <code className={className}>{raw}</code>
      </pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  code({ className, children, ...rest }) {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
    return (
      <code
        className="rounded-md border border-border/50 bg-muted/70 px-1 py-0.5 font-mono text-[12.5px] text-foreground"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    // CodeBlock already renders <pre>; pass through
    return <>{children}</>;
  },
  a({ children, href }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:decoration-primary"
      >
        {children}
      </a>
    );
  },
};

export function TextPart({ text, isUser, streaming }: TextPartProps) {
  if (!text) return null;

  if (isUser) {
    return (
      <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2 text-primary-foreground shadow-xs">
        <p className="whitespace-pre-wrap wrap-break-word text-[14px] leading-relaxed">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none wrap-break-word text-[14px] leading-relaxed text-foreground",
        "prose-headings:font-heading prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2",
        "prose-p:my-2 prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-muted-foreground",
        "prose-hr:border-border/60",
        "prose-table:text-[13px]",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
        {text}
      </Markdown>
      {streaming && (
        <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 rounded-sm bg-foreground/80 align-text-bottom animate-(--animate-blink)" />
      )}
    </div>
  );
}
