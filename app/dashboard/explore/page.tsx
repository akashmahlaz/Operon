"use client";

import { useState } from "react";
import { Search, Globe, FileText, Users, Link2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const quickActions = [
  { label: "Verify Domain", icon: Globe, description: "Check ads.txt, DNS, SSL, risk score" },
  { label: "Inspect Sellers", icon: Users, description: "Parse sellers.json and validate IDs" },
  { label: "Trace Supply Chain", icon: Link2, description: "Follow schain from DSP to publisher" },
  { label: "Fetch ads.txt", icon: FileText, description: "Download and parse ads.txt entries" },
];

const recentSearches = [
  { domain: "cnn.com", risk: "Low", lastChecked: "2 hours ago" },
  { domain: "weather.com", risk: "Medium", lastChecked: "1 day ago" },
  { domain: "espn.com", risk: "Low", lastChecked: "3 days ago" },
];

export default function ExplorePage() {
  const [query, setQuery] = useState("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Explore</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search domains, sellers, publishers, exchanges, or any advertising entity
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search domain, seller ID, publisher, exchange, SSP, DSP..."
            className="h-12 pl-10 text-base"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.label} className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.description}</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Recent */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Searches</h2>
          <div className="space-y-2">
            {recentSearches.map((item) => (
              <div
                key={item.domain}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{item.domain}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={item.risk === "Low" ? "default" : "outline"}
                    className={item.risk === "Low" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}
                  >
                    {item.risk} Risk
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.lastChecked}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
