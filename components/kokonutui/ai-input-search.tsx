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
          disabled={disabled}
          className="h-8 gap-1.5 rounded-md px-2 text-xs hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 dark:hover:bg-white/10"
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
      <div className="rounded-2xl bg-black/5 p-1.5 pt-3 shadow-sm ring-1 ring-black/10 dark:bg-white/5 dark:ring-white/10">
        <div className="mx-2 mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <OperonMark className="size-4 rounded-md" />
            <span className="truncate">Operon chat</span>
          </div>
          <span className="hidden shrink-0 sm:inline">Streaming with reasoning</span>
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
              className="min-h-18 w-full resize-none rounded-xl rounded-b-none border-0 bg-black/5 px-4 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-not-allowed dark:bg-white/5"
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

          <div className="flex h-14 items-center rounded-b-xl bg-black/5 dark:bg-white/5">
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled || isLoading || models.length === 0}
                      className="h-8 max-w-52 gap-1 rounded-md pl-1.5 pr-2 text-xs hover:bg-black/10 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 dark:hover:bg-white/10"
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

                <div className="h-4 w-px bg-black/10 dark:bg-white/10" />

                <ReasoningDropdown
                  value={reasoningLevel}
                  disabled={disabled || isLoading}
                  onChange={onReasoningLevelChange}
                />

                {onAttach && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Attach file"
                        onClick={onAttach}
                        disabled={disabled || isLoading}
                        className="flex size-8 items-center justify-center rounded-lg bg-black/5 text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <Paperclip className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Attach file</TooltipContent>
                  </Tooltip>
                )}
              </div>

              {isLoading ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Stop generating"
                      onClick={onStop}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-muted-foreground transition-colors hover:bg-black/10 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10"
                    >
                      <StopCircle className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Stop generating</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="submit"
                  aria-label="Send message"
                  disabled={disabled || !value.trim()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-foreground transition-colors hover:bg-black/10 disabled:text-muted-foreground disabled:opacity-50 dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <ArrowRight className={cn("size-4 transition-opacity", value.trim() ? "opacity-100" : "opacity-35")} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
