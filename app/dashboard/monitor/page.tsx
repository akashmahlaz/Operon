"use client";

import { Bell, Globe, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const monitoredAssets = [
  { domain: "cnn.com", status: "healthy", lastCheck: "4 min ago", changes: 0, alerts: 0 },
  { domain: "bbc.com", status: "healthy", lastCheck: "12 min ago", changes: 0, alerts: 0 },
  { domain: "weather.com", status: "warning", lastCheck: "1 hr ago", changes: 2, alerts: 1 },
  { domain: "nytimes.com", status: "healthy", lastCheck: "8 min ago", changes: 0, alerts: 0 },
  { domain: "foxnews.com", status: "alert", lastCheck: "2 hr ago", changes: 3, alerts: 2 },
];

const recentAlerts = [
  { domain: "weather.com", type: "ads.txt changed", time: "1 hour ago", severity: "warning" },
  { domain: "foxnews.com", type: "Seller removed", time: "2 hours ago", severity: "critical" },
  { domain: "foxnews.com", type: "New reseller added", time: "2 hours ago", severity: "info" },
  { domain: "weather.com", type: "SSL certificate expiring", time: "1 day ago", severity: "warning" },
];

export default function MonitorPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Monitor</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Continuous monitoring for ads.txt changes, seller updates, fraud alerts, and domain health
            </p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> Add Domain
          </Button>
        </div>

        {/* Monitored Assets */}
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Monitored Domains</h2>
          <div className="space-y-2">
            {monitoredAssets.map((asset) => (
              <div
                key={asset.domain}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`size-2.5 rounded-full ${
                      asset.status === "healthy"
                        ? "bg-emerald-500"
                        : asset.status === "warning"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  <Globe className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{asset.domain}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {asset.lastCheck}
                  </div>
                  {asset.changes > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700">
                      {asset.changes} changes
                    </Badge>
                  )}
                  {asset.alerts > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      {asset.alerts} alerts
                    </Badge>
                  )}
                  {asset.status === "healthy" && (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                      Healthy
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Alerts</h2>
          <div className="space-y-2">
            {recentAlerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {alert.severity === "critical" ? (
                    <AlertTriangle className="size-4 text-red-500" />
                  ) : alert.severity === "warning" ? (
                    <AlertTriangle className="size-4 text-amber-500" />
                  ) : (
                    <Bell className="size-4 text-blue-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{alert.type}</p>
                    <p className="text-xs text-muted-foreground">{alert.domain}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
