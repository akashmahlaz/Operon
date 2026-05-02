"use client";

import { ArrowRight, Bot, BrainCircuit, Check, ChevronDown, Paperclip, StopCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { OperonMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

export type ReasoningLevel = "auto" | "low" | "medium" | "high";

export interface PromptModelOption {
  value: string;
  label: string;
  providerLabel?: string;
}

interface AIInputSearchProps {
  value: string;
  models: PromptModelOption[];
  selectedModel: string;
  reasoningLevel: ReasoningLevel;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onAttach?: () => void;
  onStop?: () => void;
  onModelChange: (model: string) => void;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
}

const reasoningOptions: Array<{ value: ReasoningLevel; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function providerGlyph(model: string) {
  const lower = model.toLowerCase();
  if (lower.includes("operon")) return <OperonMark className="size-4 rounded-md" />;
  if (lower.includes("claude") || lower.includes("anthropic")) {
    return <span className="flex size-4 items-center justify-center text-[13px] font-bold leading-none">A</span>;
  }
  if (lower.includes("gpt") || lower.includes("openai")) {
    return <span className="flex size-4 items-center justify-center text-[13px] font-semibold leading-none">O</span>;
  }
  return <Bot className="size-4 text-muted-foreground" />;
}

function compactModelLabel(model: string) {
  return model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
}

function ReasoningDropdown({
  value,
  disabled,
  onChange,
}: {
  value: ReasoningLevel;
  disabled?: boolean;
  onChange: (value: ReasoningLevel) => void;
}) {
  const selected = reasoningOptions.find((option) => option.value === value) ?? reasoningOptions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="gap-1.5 px-2"
        >
          <BrainCircuit className="size-3.5 text-muted-foreground" />
          <span className="hidden sm:inline">{selected.label}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="min-w-36 rounded-xl">
        {reasoningOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="flex items-center justify-between gap-2"
            onSelect={() => onChange(option.value)}
          >
            <span>{option.label}</span>
            {value === option.value && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function AI_Input_Search({
  value,
  models,
  selectedModel,
  reasoningLevel,
  placeholder = "What can I do for you?",
  disabled,
  isLoading,
  className,
  onChange,
  onSubmit,
  onAttach,
  onStop,
  onModelChange,
  onReasoningLevelChange,
}: AIInputSearchProps) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 72,
    maxHeight: 300,
  });

  const selectedOption =
    models.find((model) => model.value === selectedModel) ??
    ({ value: selectedModel, label: compactModelLabel(selectedModel) } satisfies PromptModelOption);

  useEffect(() => {
    adjustHeight(value.length === 0);
  }, [adjustHeight, value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled || isLoading) return;
    onSubmit(trimmed);
  }

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="rounded-md border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <OperonMark className="size-4 rounded-sm" />
            <span className="truncate font-medium text-foreground">Operon</span>
            <span className="flex items-center gap-1 text-[10px]">
              {isLoading ? (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span>Thinking…</span>
                </>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  <span>Ready</span>
                </>
              )}
            </span>
          </div>
          <span className="hidden shrink-0 sm:inline">Enter to send · Shift+Enter newline</span>
        </div>

        <div className="relative flex flex-col">
          <div className="max-h-100 overflow-y-auto">
            <Textarea
              ref={textareaRef}
              id="operon-ai-prompt"
              value={value}
              disabled={disabled || isLoading}
              placeholder={placeholder}
              rows={1}
              className="min-h-18 w-full resize-none rounded-none border-0 bg-transparent px-3 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed"
              onChange={(event) => {
                onChange(event.target.value);
                adjustHeight();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-2">
              <div className="flex min-w-0 items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || isLoading || models.length === 0}
                      className="max-w-52 gap-1.5 px-2"
                    >
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={selectedOption.value}
                          className="flex min-w-0 items-center gap-1.5"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.15 }}
                        >
                          <span className="shrink-0">{providerGlyph(selectedOption.label)}</span>
                          <span className="truncate">{selectedOption.label}</span>
                          <ChevronDown className="size-3 shrink-0 opacity-50" />
                        </motion.span>
                      </AnimatePresence>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="max-h-80 min-w-64 overflow-y-auto rounded-xl">
                    {models.map((model) => (
                      <DropdownMenuItem
                        key={model.value}
                        className="flex items-center justify-between gap-3"
                        onSelect={() => onModelChange(model.value)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {providerGlyph(model.label)}
                          <div className="min-w-0">
                            <p className="truncate text-sm">{model.label}</p>
                            {model.providerLabel && (
                              <p className="truncate text-[11px] text-muted-foreground">{model.providerLabel}</p>
                            )}
                          </div>
                        </div>
                        {selectedModel === model.value && <Check className="size-4 shrink-0 text-primary" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-px bg-border" />

                <ReasoningDropdown
                  value={reasoningLevel}
                  disabled={disabled || isLoading}
                  onChange={onReasoningLevelChange}
                />

                {onAttach && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Attach file"
                        onClick={onAttach}
                        disabled={disabled || isLoading}
                      >
                        <Paperclip className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Attach file</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {isLoading ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="Stop generating"
                      onClick={onStop}
                    >
                      <StopCircle className="size-3.5" />
                      Stop
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Stop generating</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  aria-label="Send message"
                  disabled={disabled || !value.trim()}
                >
                  Send
                  <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
        </div>
      </div>
    </form>
  );
}
