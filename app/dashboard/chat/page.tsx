"use client";

import { useState } from "react";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { ChatHeader } from "@/components/chat/chat-header";
import Input from "@/components/chat/ai-input/input";
import Message from "@/components/chat/message/messege";

export default function Chat() {
  const [channel, setChannel] = useState<"web" | "whatsapp" | "telegram">("web");

  return (
    <div className="flex h-svh flex-col">
      <DashboardTopbar
        title="Chat"
        subtitle="Talk to Brilion across any channel"
      />
      <ChatHeader channel={channel} onChannelChange={setChannel} />
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex flex-1 min-h-0 flex-col">
          <Message />
        </div>
        <Input />
      </div>
    </div>
  );
}
