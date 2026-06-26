"use client";

import { FileBarChart, FileText, Download, Calendar, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const reportTemplates = [
  { id: "publisher-audit", title: "Publisher Audit", description: "Full compliance and quality audit for a publisher domain", format: "PDF" },
  { id: "fraud-report", title: "Fraud Report", description: "IVT detection, domain spoofing, and suspicious traffic analysis", format: "PDF" },
  { id: "supply-chain", title: "Supply Chain Report", description: "End-to-end schain validation with seller authorization status", format: "PDF" },
  { id: "executive-summary", title: "Executive Summary", description: "High-level overview for leadership — risk scores, trends, actions", format: "PDF" },
  { id: "ads-txt-diff", title: "ads.txt Change Report", description: "Track additions, removals, and modifications in ads.txt over time", format: "CSV" },
  { id: "inventory-quality", title: "Inventory Quality", description: "MFA detection, viewability, and traffic quality scoring", format: "JSON" },
];

const recentReports = [
  { title: "Publisher Audit - cnn.com", date: "2024-01-15", status: "completed", format: "PDF" },
  { title: "Fraud Report - Q4 2024", date: "2024-01-10", status: "completed", format: "PDF" },
  { title: "Supply Chain - weather.com", date: "2024-01-08", status: "completed", format: "PDF" },
];

export default function ReportsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Reports</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Generate audits, compliance reports, and executive summaries
            </p>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> Generate Report
          </Button>
        </div>

        {/* Report Templates */}
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Report Templates</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reportTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm">{template.title}</CardTitle>
                    <Badge variant="outline" className="text-[10px]">{template.format}</Badge>
                  </div>
                  <CardDescription className="text-xs">{template.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent Reports</h2>
          <div className="space-y-2">
            {recentReports.map((report, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <FileBarChart className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{report.title}</p>
                    <p className="text-xs text-muted-foreground">{report.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                    {report.status}
                  </Badge>
                  <Button variant="ghost" size="sm" className="size-8 p-0">
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
