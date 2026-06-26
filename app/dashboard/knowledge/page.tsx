"use client";

import { useState } from "react";
import { BookOpen, Search, FileText, ExternalLink, Folder } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const knowledgeCategories = [
  { title: "IAB Specs", description: "ads.txt, app-ads.txt, sellers.json, OpenRTB specifications", count: 24, icon: FileText },
  { title: "Matterfull Docs", description: "Internal documentation, runbooks, and engineering guides", count: 18, icon: Folder },
  { title: "AdOps Playbooks", description: "Standard operating procedures for common investigations", count: 12, icon: BookOpen },
  { title: "Exchange Documentation", description: "Google Ad Manager, Prebid, Magnite, OpenX, Pubmatic", count: 31, icon: ExternalLink },
  { title: "Fraud Detection", description: "IVT patterns, domain spoofing, click fraud identification", count: 9, icon: FileText },
  { title: "Industry Standards", description: "TAG, MRC, JICWEBS compliance guidelines", count: 7, icon: FileText },
];

export default function KnowledgePage() {
  const [search, setSearch] = useState("");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Knowledge</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Search internal documentation, IAB specifications, and industry knowledge base
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ask anything... e.g. 'How does schain work?' or 'What is MFA?'"
            className="h-12 pl-10 text-base"
          />
        </div>

        {/* Categories */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {knowledgeCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Card key={category.title} className="cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-cyan-500" />
                    <CardTitle className="text-sm">{category.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">{category.description}</p>
                  <p className="mt-2 text-xs font-medium text-cyan-600">{category.count} documents</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
