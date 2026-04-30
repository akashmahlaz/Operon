'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import TextPart from './parts/textPart';
import ReasoningPart from './parts/ai-reasoning';
import ToolPart from './parts/tools/tools-show-ui';

// ─────────────────────────────────────
// AVATAR — AI ya User ka icon
// ─────────────────────────────────────
function Avatar({ role }: { role: string }) {
  const isUser = role === 'user';
  return (
    <div className={`
      w-8 h-8 rounded-xl shrink-0 flex items-center justify-center
      text-xs font-mono font-medium mt-0.5
      ${isUser
        ? 'bg-white/5 border border-white/10 text-white/40'
        : 'bg-green-400/10 border border-green-400/20 text-green-400'
      }
    `}>
      {isUser ? 'U' : 'AI'}
    </div>
  );
}

// ─────────────────────────────────────
// PART RENDERER — decide karo kaunsa part render karna hai
// ─────────────────────────────────────
function PartRenderer({ part, role }: { part: any; role: string }) {
  const isUser = role === 'user';

  switch (part.type) {
    case 'text':
      return <TextPart text={part.text} isUser={isUser} />;

    case 'reasoning':
      return <ReasoningPart text={part.text} />;

    case 'tool-invocation':
      return <ToolPart tool={part} />;

    default:
      return null; // unknown part = kuch mat dikhao, crash mat karo
  }
}

// ─────────────────────────────────────
// MESSAGE ROW — ek poora message (avatar + bubbles)
// ─────────────────────────────────────
function MessageRow({ message }: { message: any }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>

      {/* Avatar */}
      <Avatar role={message.role} />

      {/* Saare parts is message ke */}
      <div className={`flex flex-col gap-2 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {message.parts.map((part: any, i: number) => (
          <PartRenderer key={i} part={part} role={message.role} />
        ))}
      </div>

    </div>
  );
}

// ─────────────────────────────────────
// MAIN MESSAGE COMPONENT — yahi export hota hai page.tsx mein
// ─────────────────────────────────────
export default function Message() {
  const { messages } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Naya message aane par automatically scroll karo neeche
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">

      {/* Agar koi message nahi hai */}
      {messages.length === 0 && (
        <div className="flex-1 flex items-center justify-center h-full">
          <p className="text-white/20 text-sm">Start a conversation...</p>
        </div>
      )}

      {/* Har message render karo */}
      {messages.map(message => (
        <MessageRow key={message.id} message={message} />
      ))}

      {/* Yeh invisible div hai — scroll iske paas aata hai */}
      <div ref={bottomRef} />
    </div>
  );
}