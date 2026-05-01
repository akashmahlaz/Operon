"use client";

import { useState } from "react";
import { Sparkles, Plus, Play, Pause, Trash2, MoreHorizontal, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  description: string;
  tools: string[];
  enabled: boolean;
}

const sampleAgents: Agent[] = [
  {
    id: "1",
    name: "Marketing autopilot",
    description: "Drafts, schedules and reports on social campaigns across all channels.",
    tools: ["web_search", "generate_image", "whatsapp_send"],
    enabled: true,
  },
  {
    id: "2",
    name: "Inbox triage",
    description: "Reads new mail, drafts replies, and files away the rest.",
    tools: ["memory_recall"],
    enabled: false,
  },
  {
    id: "3",
    name: "Code reviewer",
    description: "Reviews pull requests, highlights issues, and suggests improvements.",
    tools: ["github_read_file", "github_write_file"],
    enabled: true,
  },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(sampleAgents);

  const toggleAgent = (id: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
    toast.success("Agent updated");
  };

  const deleteAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    toast.success("Agent deleted");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Agents</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Reusable AI workers with their own prompt + tool kit
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-full"
            onClick={() => toast.info("Agent creation coming soon")}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New agent
          </Button>
        </div>

        {/* Agents Grid */}
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-24 text-center">
            <Bot className="size-10 text-muted-foreground mb-3" />
            <p className="font-medium">No agents yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first agent to get started
            </p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={() => toast.info("Coming soon")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <Card key={agent.id} className="transition-shadow hover:shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-10 items-center justify-center rounded-xl",
                          agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}
                      >
                        <Sparkles className="size-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <CardDescription className="mt-0.5">
                          {agent.enabled ? (
                            <span className="text-green-600">Active</span>
                          ) : (
                            <span className="text-muted-foreground">Paused</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toggleAgent(agent.id)}>
                          {agent.enabled ? (
                            <>
                              <Pause className="mr-2 size-4" /> Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 size-4" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteAgent(agent.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{agent.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {agent.tools.map((tool) => (
                      <Badge key={tool} variant="outline" className="font-mono text-xs">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
