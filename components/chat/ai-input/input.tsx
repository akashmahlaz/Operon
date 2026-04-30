'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Mic, X, FileText } from 'lucide-react';

export default function Input() {

  // ─────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────

  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, status } = useChat();

  const isStreaming = status === 'streaming' || status === 'submitted';
  const canSend = input.trim().length > 0 && !isStreaming;

  // ─────────────────────────────────────────────
  // AUTO RESIZE TEXTAREA
  // jab user type kare, textarea khud grow kare
  // ─────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';                              // pehle collapse karo
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'; // phir content ke hisaab se grow karo (max 160px)
  }, [input]); // input badlega tab chalega

  // ─────────────────────────────────────────────
  // SEND MESSAGE
  // ─────────────────────────────────────────────

  function handleSend() {
    if (!canSend) return;
    sendMessage({ text: input });
    setInput('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // send ke baad reset karo
    }
  }

  // ─────────────────────────────────────────────
  // KEYBOARD — Enter send karo, Shift+Enter newline
  // ─────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // browser ka default newline rokta hai
      handleSend();
    }
  }

  // ─────────────────────────────────────────────
  // FILE ATTACH
  // ─────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; // pehli file lo
    if (!file) return;
    setAttachedFile(file);
    e.target.value = ''; // input reset karo taaki same file dobara attach ho sake
  }

  function removeFile() {
    setAttachedFile(null);
  }

  // ─────────────────────────────────────────────
  // VOICE (placeholder — baad mein implement karein)
  // ─────────────────────────────────────────────

  function handleVoice() {
    setIsRecording(!isRecording);
    // TODO: Web Speech API yahan lagayenge baad mein
  }

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="w-full  bg- black px-4 py-4 border-t border-white/10 flex-shrink-0">

      {/* ── File Preview — attach hui file dikhao ── */}
      {attachedFile && (
        <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl w-fit">
          <FileText className="w-4 h-4 text-white/40" />
          <span className="text-xs text-white/50 max-w-[200px] truncate">
            {attachedFile.name}
          </span>
          <button
            onClick={removeFile}
            className="ml-1 text-white/20 hover:text-white/60 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Main Input Box ── */}
      <div className={`
        flex flex-col gap-2 px-3 py-3
        bg-white/5 border rounded-2xl
        transition-colors duration-200
        ${isStreaming
          ? 'border-white/5 opacity-70'        // streaming ke waqt dimmed
          : 'border-white/10 focus-within:border-white/20'  // normal
        }
      `}>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? 'AI is responding...' : 'Message MiniMax...'}
          rows={1}
          className="
            w-full bg-transparent outline-none resize-none
            text-sm text-white/80 placeholder-white/20
            leading-relaxed caret-green-400
            disabled:cursor-not-allowed
            max-h-[160px] overflow-y-auto
          "
          style={{ scrollbarWidth: 'none' }} // scrollbar hide karo textarea mein
        />

        {/* ── Bottom Bar — buttons ── */}
        <div className="flex items-center justify-between">

          {/* LEFT — Attach + Voice */}
          <div className="flex items-center gap-1">

            {/* Hidden file input — real file picker */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt" // allowed file types
            />

            {/* Paperclip button — file input trigger karta hai */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="
                w-8 h-8 rounded-xl flex items-center justify-center
                text-white/30 hover:text-white/60 hover:bg-white/5
                transition-all duration-150 cursor-pointer
                disabled:opacity-30 disabled:cursor-not-allowed
              "
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice button */}
            <button
              onClick={handleVoice}
              disabled={isStreaming}
              className={`
                w-8 h-8 rounded-xl flex items-center justify-center
                transition-all duration-150 cursor-pointer
                disabled:opacity-30 disabled:cursor-not-allowed
                ${isRecording
                  ? 'text-red-400 bg-red-400/10 border border-red-400/20 animate-pulse' // recording state
                  : 'text-white/30 hover:text-white/60 hover:bg-white/5'                // idle state
                }
              `}
            >
              <Mic className="w-4 h-4" />
            </button>

          </div>

          {/* RIGHT — Character count + Send button */}
          <div className="flex items-center gap-3">

            {/* Character count — sirf tab dikhao jab type ho raha ho */}
            {input.length > 0 && (
              <span className="text-[10px] font-mono text-white/20">
                {input.length}
              </span>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`
                w-8 h-8 rounded-xl flex items-center justify-center
                transition-all duration-200 cursor-pointer
                ${canSend
                  ? 'bg-green-400 hover:bg-green-300 active:scale-95'  // ready to send
                  : 'bg-white/10 cursor-not-allowed'                    // disabled
                }
              `}
            >
              {/* Streaming ke waqt spinner, warna arrow */}
              {isStreaming ? (
                <div className="w-3.5 h-3.5 rounded-full border border-white/30 border-t-white/80 animate-spin" />
              ) : (
                <ArrowUp className={`w-4 h-4 ${canSend ? 'text-black' : 'text-white/20'}`} />
              )}
            </button>

          </div>
        </div>
      </div>

      {/* ── Bottom hint ── */}
      <p className="text-center text-[10px] text-white/15 font-mono mt-2">
        Enter to send · Shift+Enter for new line
      </p>

    </div>
  );
} 