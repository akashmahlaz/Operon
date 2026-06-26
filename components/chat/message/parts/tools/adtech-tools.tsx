"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdsTxtEntry {
  type: string;
  exchange?: string;
  seller_id?: string;
  relationship?: string;
  cert_authority_id?: string;
  key?: string;
  value?: string;
}

interface AdsTxtResult {
  domain: string;
  status: string;
  total_entries?: number;
  direct_sellers?: number;
  resellers?: number;
  variables?: number;
  entries?: AdsTxtEntry[];
  url?: string;
  message?: string;
}

export function AdsTxtToolOutput({ data }: { data: AdsTxtResult }) {
  if (data.status === "not_found") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          No ads.txt found for {data.domain}
        </p>
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{data.message}</p>
      </div>
    );
  }

  if (data.status === "error") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950">
        <p className="font-medium text-red-800 dark:text-red-200">
          Error fetching ads.txt for {data.domain}
        </p>
      </div>
    );
  }

  const entries = data.entries?.filter((e) => e.type === "entry") ?? [];
  const displayEntries = entries.slice(0, 20);

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">ads.txt — {data.domain}</span>
        <div className="flex gap-1.5">
          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700">
            {data.direct_sellers} DIRECT
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700">
            {data.resellers} RESELLER
          </Badge>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
        {displayEntries.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <span className={cn(
              "w-16 shrink-0 text-[10px] font-medium",
              entry.relationship === "DIRECT" ? "text-emerald-600" : "text-blue-600"
            )}>
              {entry.relationship}
            </span>
            <span className="text-foreground/80">{entry.exchange}</span>
            <span className="text-muted-foreground">{entry.seller_id}</span>
          </div>
        ))}
        {entries.length > 20 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            ...and {entries.length - 20} more entries
          </p>
        )}
      </div>
    </div>
  );
}

interface SellersJsonResult {
  domain: string;
  status: string;
  total_sellers?: number;
  sellers_returned?: number;
  sellers?: Array<{
    seller_id?: string;
    name?: string;
    domain?: string;
    seller_type?: string;
    is_confidential?: number;
  }>;
}

export function SellersJsonToolOutput({ data }: { data: SellersJsonResult }) {
  if (data.status !== "found") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          sellers.json not found for {data.domain}
        </p>
      </div>
    );
  }

  const sellers = data.sellers ?? [];
  const display = sellers.slice(0, 15);

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">sellers.json — {data.domain}</span>
        <Badge variant="outline" className="text-[10px]">
          {data.total_sellers} sellers total
        </Badge>
      </div>
      <div className="max-h-48 overflow-y-auto rounded bg-muted/50 p-2 font-mono text-[11px]">
        {display.map((seller, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5 border-b border-border/30 last:border-0">
            <span className="w-24 shrink-0 truncate text-foreground/80">{seller.seller_id}</span>
            <span className="flex-1 truncate text-muted-foreground">{seller.name || "—"}</span>
            <Badge variant="outline" className="text-[9px] shrink-0">
              {seller.seller_type || "?"}
            </Badge>
          </div>
        ))}
        {sellers.length > 15 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            ...and {sellers.length - 15} more sellers
          </p>
        )}
      </div>
    </div>
  );
}

interface VerifyDomainResult {
  domain: string;
  investigation_status: string;
  risk_score?: number;
  risk_factors?: string[];
  ads_txt?: { status?: string; direct_sellers?: number; resellers?: number };
  dns?: { success?: boolean };
  ssl?: { valid?: boolean };
}

export function VerifyDomainToolOutput({ data }: { data: VerifyDomainResult }) {
  const riskColor = (data.risk_score ?? 0) < 20
    ? "text-emerald-600 bg-emerald-50"
    : (data.risk_score ?? 0) < 40
      ? "text-amber-600 bg-amber-50"
      : "text-red-600 bg-red-50";

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Domain Verification — {data.domain}</span>
        <Badge className={cn("text-[10px]", riskColor)}>
          Risk: {data.risk_score ?? 0}%
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded border p-2 text-center">
          <p className="font-medium">ads.txt</p>
          <p className={cn("text-[10px]", data.ads_txt?.status === "found" ? "text-emerald-600" : "text-red-600")}>
            {data.ads_txt?.status === "found" ? "Found" : "Missing"}
          </p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="font-medium">DNS</p>
          <p className={cn("text-[10px]", data.dns?.success ? "text-emerald-600" : "text-amber-600")}>
            {data.dns?.success ? "Resolved" : "Check"}
          </p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="font-medium">SSL</p>
          <p className={cn("text-[10px]", data.ssl?.valid ? "text-emerald-600" : "text-red-600")}>
            {data.ssl?.valid ? "Valid" : "Issues"}
          </p>
        </div>
      </div>
      {data.risk_factors && data.risk_factors.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-muted-foreground">Risk factors:</p>
          <ul className="mt-0.5 list-inside list-disc text-[10px] text-muted-foreground">
            {data.risk_factors.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

interface FraudResult {
  domain: string;
  risk_level: string;
  signal_count?: number;
  signals?: Array<{ type: string; severity: string; finding: string }>;
}

export function FraudDetectionToolOutput({ data }: { data: FraudResult }) {
  const riskColor = data.risk_level === "clean"
    ? "bg-emerald-50 text-emerald-700"
    : data.risk_level === "low"
      ? "bg-blue-50 text-blue-700"
      : data.risk_level === "medium"
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700";

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Fraud Detection — {data.domain}</span>
        <Badge className={cn("text-[10px]", riskColor)}>
          {data.risk_level}
        </Badge>
      </div>
      {data.signals && data.signals.length > 0 ? (
        <div className="space-y-1.5">
          {data.signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-2 rounded bg-muted/50 p-2 text-xs">
              <Badge variant="outline" className={cn(
                "shrink-0 text-[9px]",
                signal.severity === "high" ? "border-red-300 text-red-700" :
                signal.severity === "medium" ? "border-amber-300 text-amber-700" :
                "border-blue-300 text-blue-700"
              )}>
                {signal.severity}
              </Badge>
              <span className="text-muted-foreground">{signal.finding}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-emerald-600">No fraud signals detected.</p>
      )}
    </div>
  );
}

interface CrawlResult {
  url: string;
  status_code?: number;
  cloudflare_detected?: boolean;
  ad_tech_count?: number;
  ad_signals?: Array<{ detected: string; pattern: string }>;
  page_size_bytes?: number;
}

export function CrawlDomainToolOutput({ data }: { data: CrawlResult }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium truncate max-w-[200px]">{data.url}</span>
        <div className="flex gap-1.5">
          {data.cloudflare_detected && (
            <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700">CF</Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {data.status_code ?? "?"}
          </Badge>
        </div>
      </div>
      {data.ad_signals && data.ad_signals.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">
            Ad Tech Detected ({data.ad_tech_count}):
          </p>
          <div className="flex flex-wrap gap-1">
            {data.ad_signals.map((signal, i) => (
              <Badge key={i} variant="outline" className="text-[9px]">
                {signal.detected}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
