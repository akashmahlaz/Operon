"use client";

import { useState } from "react";
import { Package, FileText, Link2, Shield, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inventoryStats = [
  { label: "Authorized Sellers", value: "12,847", icon: CheckCircle2, color: "text-emerald-500" },
  { label: "Resellers Detected", value: "3,201", icon: Link2, color: "text-blue-500" },
  { label: "Mismatches", value: "47", icon: AlertTriangle, color: "text-amber-500" },
  { label: "Blocked Sellers", value: "12", icon: Shield, color: "text-red-500" },
];

const recentInventory = [
  { exchange: "google.com", sellerId: "pub-1234567890", relationship: "DIRECT", status: "authorized" },
  { exchange: "openx.com", sellerId: "539154393", relationship: "RESELLER", status: "authorized" },
  { exchange: "pubmatic.com", sellerId: "156451", relationship: "DIRECT", status: "mismatch" },
  { exchange: "indexexchange.com", sellerId: "184932", relationship: "RESELLER", status: "authorized" },
  { exchange: "appnexus.com", sellerId: "9325", relationship: "DIRECT", status: "unauthorized" },
];

export default function InventoryPage() {
  const [search, setSearch] = useState("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            sellers.json, app-ads.txt, supply chain validation, and authorized seller management
          </p>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {inventoryStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className={`size-5 ${stat.color}`} />
                  <div>
                    <p className="text-lg font-semibold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="sellers" className="mb-6">
          <TabsList>
            <TabsTrigger value="sellers">Sellers</TabsTrigger>
            <TabsTrigger value="app-ads">app-ads.txt</TabsTrigger>
            <TabsTrigger value="schain">Supply Chain</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="mt-4">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by exchange, seller ID, or publisher..."
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              {recentInventory.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Package className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.exchange}</p>
                      <p className="text-xs text-muted-foreground">Seller: {item.sellerId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.relationship}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        item.status === "authorized"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.status === "mismatch"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="app-ads" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Parse and validate app-ads.txt files for mobile app inventory.
                  Enter an app store URL or bundle ID to check its authorized sellers.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schain" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Validate SupplyChain objects from bid requests. Trace the complete path
                  from originating publisher to final buyer.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quality" className="mt-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Inventory quality scoring — detect MFA (Made for Advertising) sites,
                  low-value impressions, and suspicious traffic patterns.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
