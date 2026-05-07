"use client";

import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Globe, MessageCircle, Send } from "lucide-react";

interface ChatHeaderProps {
  channel: "web" | "whatsapp" | "telegram";
  onChannelChange: (c: "web" | "whatsapp" | "telegram") => void;
}

export function ChatHeader({ channel, onChannelChange }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
      <Tabs value={channel} onValueChange={(v) => onChannelChange(v as ChatHeaderProps["channel"])}>
        <TabsList className="h-8 bg-muted/50">
          <TabsTrigger value="web" className="h-6 gap-1.5 px-2.5 text-xs">
            <Globe className="h-3 w-3" />
            Web
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="h-6 gap-1.5 px-2.5 text-xs">
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="telegram" className="h-6 gap-1.5 px-2.5 text-xs">
            <Send className="h-3 w-3" />
            Telegram
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Button variant="outline" size="sm" className="h-7 rounded-full text-xs">
        Connect WhatsApp
      </Button>
    </div>
  );
}
