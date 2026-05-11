import { resolveProviderKey } from "@/lib/services/auth-profiles";

const GSC_API = "https://www.googleapis.com/webmasters/v3";
const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

async function gscFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GSC_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Search Console API ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listSearchConsoleSites(userId: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const data = await gscFetch<{ siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }>(token, "/sites");
  return data.siteEntry ?? [];
}

export interface SearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export async function querySearchAnalytics(
  userId: string,
  siteUrl: string,
  input: {
    startDate: string;
    endDate: string;
    dimensions?: Array<"query" | "page" | "country" | "device" | "date" | "searchAppearance">;
    rowLimit?: number;
    dimensionFilterGroups?: unknown[];
    type?: "web" | "image" | "video" | "news" | "discover" | "googleNews";
  },
) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const body = {
    startDate: input.startDate,
    endDate: input.endDate,
    dimensions: input.dimensions ?? ["query"],
    rowLimit: input.rowLimit ?? 50,
    dimensionFilterGroups: input.dimensionFilterGroups,
    type: input.type ?? "web",
  };
  const data = await gscFetch<{ rows?: SearchAnalyticsRow[] }>(
    token,
    `/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return data.rows ?? [];
}

export async function inspectUrlIndex(userId: string, siteUrl: string, inspectionUrl: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`URL Inspection API ${response.status}: ${text || response.statusText}`);
  }
  return response.json();
}

export async function listSitemaps(userId: string, siteUrl: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const data = await gscFetch<{ sitemap?: unknown[] }>(token, `/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
  return data.sitemap ?? [];
}

export async function submitSitemap(userId: string, siteUrl: string, feedpath: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  await gscFetch<unknown>(
    token,
    `/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`,
    { method: "PUT" },
  );
  return { ok: true, feedpath };
}

export interface PageSpeedSummary {
  url: string;
  strategy: string;
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  inp: number | null;
}

interface PsiCategory { score?: number }
interface PsiAudit { numericValue?: number }

export async function pageSpeedInsights(url: string, strategy: "mobile" | "desktop" = "mobile"): Promise<PageSpeedSummary> {
  const apiKeyParam = process.env.GOOGLE_PAGESPEED_API_KEY ? `&key=${process.env.GOOGLE_PAGESPEED_API_KEY}` : "";
  const categoryParams = ["performance", "seo", "accessibility", "best-practices"]
    .map((c) => `&category=${c}`)
    .join("");
  const response = await fetch(
    `${PSI_API}?url=${encodeURIComponent(url)}&strategy=${strategy}${categoryParams}${apiKeyParam}`,
  );
  if (!response.ok) {
    throw new Error(`PageSpeed API ${response.status}: ${response.statusText}`);
  }
  const data = (await response.json()) as {
    lighthouseResult?: {
      categories?: Record<string, PsiCategory>;
      audits?: Record<string, PsiAudit>;
    };
  };
  const cats = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};
  return {
    url,
    strategy,
    performance: cats.performance?.score ?? null,
    seo: cats.seo?.score ?? null,
    accessibility: cats.accessibility?.score ?? null,
    bestPractices: cats["best-practices"]?.score ?? null,
    fcp: audits["first-contentful-paint"]?.numericValue ?? null,
    lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
    cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
    inp: audits["interaction-to-next-paint"]?.numericValue ?? null,
  };
}
