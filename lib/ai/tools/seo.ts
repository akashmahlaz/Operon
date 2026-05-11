import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import {
  inspectUrlIndex,
  listSearchConsoleSites,
  listSitemaps,
  pageSpeedInsights,
  querySearchAnalytics,
  submitSitemap,
} from "@/lib/services/seo";

export function createSeoTools(userId: string) {
  return {
    seo_list_sites: tool({
      description: "List Search Console properties (sites) the operator has access to. Uses the connected Google OAuth token.",
      inputSchema: z.object({}),
      execute: async () => ({ sites: await listSearchConsoleSites(userId) }),
    }),
    seo_search_analytics: tool({
      description:
        "Query Search Console performance data (clicks, impressions, CTR, position) by query/page/country/device/date. Date format: YYYY-MM-DD.",
      inputSchema: z.object({
        siteUrl: z.string().min(1).describe("e.g. 'https://example.com/' or 'sc-domain:example.com'"),
        startDate: z.string().min(10),
        endDate: z.string().min(10),
        dimensions: z
          .array(z.enum(["query", "page", "country", "device", "date", "searchAppearance"]))
          .optional(),
        rowLimit: z.number().int().min(1).max(25000).optional(),
        type: z.enum(["web", "image", "video", "news", "discover", "googleNews"]).optional(),
      }),
      execute: async ({ siteUrl, ...input }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Search analytics query", metadata: { tool: "seo_search_analytics", siteUrl } });
        const { capToolResult } = await import("@/lib/ai/tools/truncate");
        return capToolResult({ rows: await querySearchAnalytics(userId, siteUrl, input) }).result;
      },
    }),
    seo_inspect_url: tool({
      description: "Inspect a URL's indexing status in Google. Returns coverage, mobile usability, AMP status, and last crawl info.",
      inputSchema: z.object({
        siteUrl: z.string().min(1),
        inspectionUrl: z.string().url(),
      }),
      execute: async ({ siteUrl, inspectionUrl }) => inspectUrlIndex(userId, siteUrl, inspectionUrl),
    }),
    seo_list_sitemaps: tool({
      description: "List submitted sitemaps for a Search Console property.",
      inputSchema: z.object({ siteUrl: z.string().min(1) }),
      execute: async ({ siteUrl }) => ({ sitemaps: await listSitemaps(userId, siteUrl) }),
    }),
    seo_submit_sitemap: tool({
      description: "Submit (or re-submit) a sitemap URL to Google for a property.",
      inputSchema: z.object({
        siteUrl: z.string().min(1),
        feedpath: z.string().url().describe("Full URL of the sitemap, e.g. 'https://example.com/sitemap.xml'."),
      }),
      execute: async ({ siteUrl, feedpath }) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Sitemap submitted", metadata: { tool: "seo_submit_sitemap", siteUrl, feedpath } });
        return submitSitemap(userId, siteUrl, feedpath);
      },
    }),
    seo_pagespeed: tool({
      description:
        "Run Google PageSpeed Insights / Lighthouse on a URL. Returns Performance/SEO/Accessibility/Best-Practices scores plus Core Web Vitals (FCP, LCP, CLS, INP).",
      inputSchema: z.object({
        url: z.string().url(),
        strategy: z.enum(["mobile", "desktop"]).optional(),
      }),
      execute: async ({ url, strategy }) => pageSpeedInsights(url, strategy ?? "mobile"),
    }),
  };
}
