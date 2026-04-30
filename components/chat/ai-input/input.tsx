"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, Mic, X, FileText, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Input() {
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, status, stop } = useChat();

  const isStreaming = status === "streaming" || status === "submitted";
  const canSend = input.trim().length > 0 && !isStreaming;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  function handleSend() {
    if (!canSend) return;
    sendMessage({ text: input });
    setInput("");
    setAttachedFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    e.target.value = "";
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-6">
      {attachedFile && (
        <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-[220px] truncate text-xs text-foreground/80">
            {attachedFile.name}
          </span>
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => setAttachedFile(null)}
            className="ml-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 rounded-3xl border bg-card px-3 py-3 shadow-sm transition-colors",
          isStreaming
            ? "border-border opacity-90"
            : "border-border focus-within:border-foreground/30",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? "Brilion is responding…" : "Message Brilion…"}
          rows={1}
          className="max-h-[200px] w-full resize-none bg-transparent px-1 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed"
          style={{ scrollbarWidth: "none" }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <button
              type="button"
              aria-label="Attach file"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Voice input"
              onClick={() => setIsRecording((v) => !v)}
              disabled={isStreaming}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors disabled:opacity-40",
                isRecording
                  ? "bg-destructive/10 text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {input.length > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {input.length}
              </span>
            )}
            {isStreaming ? (
              <button
                type="button"
                onClick={() => stop()}
                aria-label="Stop"
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background transition-transform hover:scale-105"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send message"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
                  canSend
                    ? "bg-foreground text-background hover:scale-105 active:scale-95"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/60">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
