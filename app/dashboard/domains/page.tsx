"use client";

import { useState } from "react";
import { Globe, Shield, Lock, Server, FileText, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const monitoredDomains = [
  { domain: "cnn.com", adsTxt: true, ssl: true, risk: 12, sellers: 847, status: "healthy" },
  { domain: "bbc.com", adsTxt: true, ssl: true, risk: 8, sellers: 623, status: "healthy" },
  { domain: "weather.com", adsTxt: true, ssl: true, risk: 34, sellers: 412, status: "warning" },
  { domain: "espn.com", adsTxt: true, ssl: true, risk: 15, sellers: 556, status: "healthy" },
  { domain: "foxnews.com", adsTxt: true, ssl: true, risk: 22, sellers: 731, status: "healthy" },
];

export default function DomainsPage() {
  const [search, setSearch] = useState("");

  const filtered = monitoredDomains.filter((d) =>
    d.domain.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Domains</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Inspect ads.txt, DNS, SSL, headers, and risk scores for any domain
            </p>
          </div>
        </div>

        <div className="relative mb-6">
          <Globe className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Enter domain to investigate..."
            className="h-11 pl-10"
          />
        </div>

        <Tabs defaultValue="overview" className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ads-txt">ads.txt</TabsTrigger>
            <TabsTrigger value="sellers">Sellers</TabsTrigger>
            <TabsTrigger value="supply-chain">Supply Chain</TabsTrigger>
            <TabsTrigger value="dns">DNS</TabsTrigger>
            <TabsTrigger value="ssl">SSL</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="space-y-2">
              {filtered.map((domain) => (
                <div
                  key={domain.domain}
                  className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="size-4 text-blue-500" />
                    <span className="text-sm font-medium">{domain.domain}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">ads.txt</span>
                      {domain.adsTxt && <Badge variant="outline" className="text-emerald-600 text-[10px] px-1.5">OK</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="size-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">SSL</span>
                      {domain.ssl && <Badge variant="outline" className="text-emerald-600 text-[10px] px-1.5">OK</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{domain.sellers} sellers</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        domain.risk < 20
                          ? "bg-emerald-50 text-emerald-700"
                          : domain.risk < 30
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                      }
                    >
                      Risk {domain.risk}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ads-txt" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Enter a domain above and click search to fetch and parse its ads.txt file.
                  The AI agent can also do this via chat — try &quot;Fetch ads.txt for cnn.com&quot;.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sellers" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  View sellers.json data and authorized seller relationships for any exchange.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="supply-chain" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Trace the supply chain (schain) from DSP bid requests back to the publisher.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dns" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  DNS records, WHOIS data, nameservers, and IP geolocation for the domain.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ssl" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  SSL certificate details, chain validation, and expiry information.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
