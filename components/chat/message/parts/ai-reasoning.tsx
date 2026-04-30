'use client';
import { useState } from 'react';

// AI ki thinking dikhata hai — collapse/expand hoti hai
export default function ReasoningPart({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full border border-white/10 rounded-xl overflow-hidden">

      {/* Yeh button click karo to open/close hoga */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors duration-150 cursor-pointer"
      >
        <div className="w-3 h-3 rounded-full border border-purple-400/60 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
        </div>
        <span className="text-xs text-white/30 font-mono">Reasoning</span>
        <span className="ml-auto text-white/20 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* Sirf tab dikhao jab open === true ho */}
      {open && (
        <div className="px-3 py-2 border-t border-white/10 text-xs text-white/30 leading-relaxed font-mono whitespace-pre-wrap">
          {text}
        </div>
      )}

    </div>
  );
}