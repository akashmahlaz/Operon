"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import type { Highlighter, BundledLanguage, BundledTheme } from "shiki";

// Lazy-load shiki ONCE per page; cache the highlighter & loaded languages.
let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import("shiki").then((shiki) =>
      shiki.createHighlighter({
        themes: ["github-dark-default", "github-light-default"],
        langs: ["ts", "tsx", "js", "jsx", "json", "bash", "shell", "md"],
      }),
    );
  }
  return highlighterPromise;
}

const LANG_ALIASES: Record<string, BundledLanguage> = {
  ts: "ts",
  typescript: "ts",
  tsx: "tsx",
  js: "js",
  javascript: "js",
  jsx: "jsx",
  json: "json",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kotlin: "kotlin",
  swift: "swift",
  rb: "ruby",
  ruby: "ruby",
  php: "php",
  cs: "csharp",
  csharp: "csharp",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  html: "html",
  css: "css",
  scss: "scss",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  sql: "sql",
  md: "md",
  markdown: "md",
  diff: "diff",
  dockerfile: "docker",
  docker: "docker",
  vue: "vue",
  svelte: "svelte",
  graphql: "graphql",
  gql: "graphql",
};

function normalizeLang(lang: string): BundledLanguage | null {
  const key = lang.toLowerCase().trim();
  return LANG_ALIASES[key] ?? null;
}

export function CodeHighlight({
  code,
  lang,
  className,
}: {
  code: string;
  lang: string;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const normalized = normalizeLang(lang);

  useEffect(() => {
    let cancelled = false;
    if (!normalized) {
      setHtml(null);
      return;
    }

    (async () => {
      try {
        const hl = await getHighlighter();
        if (!loadedLangs.has(normalized)) {
          await hl.loadLanguage(normalized);
          loadedLangs.add(normalized);
        }
        const themeName: BundledTheme =
          resolvedTheme === "dark" ? "github-dark-default" : "github-light-default";
        const out = hl.codeToHtml(code, {
          lang: normalized,
          theme: themeName,
        });
        if (!cancelled) setHtml(out);
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, normalized, resolvedTheme]);

  if (!html) {
    // Fallback: plain pre while shiki loads or for unknown langs
    return (
      <pre
        className={
          className ??
          "overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-foreground/90"
        }
      >
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className={className ?? "[&>pre]:bg-transparent! [&>pre]:overflow-x-auto [&>pre]:px-3 [&>pre]:py-2.5 [&>pre]:font-mono [&>pre]:text-[12.5px] [&>pre]:leading-relaxed"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
