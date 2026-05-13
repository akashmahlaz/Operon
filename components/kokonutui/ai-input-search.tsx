"use client";

import { ProviderIcon as LobeProviderIcon } from "@lobehub/icons";
import { ArrowUp, Bot, BrainCircuit, Check, ChevronDown, Paperclip, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
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
  reasoningSupported?: boolean;
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

const reasoningLabels: Record<ReasoningLevel, string> = {
  auto: "Adaptive",
  low: "Low",
  medium: "Medium",
  high: "High",
};

function extractProvider(modelValue: string, providerLabel?: string): string {
  if (modelValue.includes("/")) {
    const prefix = modelValue.split("/")[0].toLowerCase();
    if (prefix === "google-ai" || prefix === "gemini") return "google";
    if (prefix === "github-copilot") return "githubcopilot";
    return prefix;
  }
  if (providerLabel) return providerLabel.toLowerCase().replace(/\s+/g, "");
  const lower = modelValue.toLowerCase();
  if (lower.includes("claude") || lower.includes("anthropic")) return "anthropic";
  if (lower.includes("gpt") || lower.includes("openai")) return "openai";
  if (lower.includes("gemini")) return "google";
  if (lower.includes("mistral")) return "mistral";
  if (lower.includes("llama") || lower.includes("groq")) return "groq";
  if (lower.includes("deepseek")) return "deepseek";
  return "";
}

function ModelProviderIcon({ modelValue, providerLabel, size = 16 }: { modelValue: string; providerLabel?: string; size?: number }) {
  const provider = extractProvider(modelValue, providerLabel);
  if (!provider) return <Bot className="size-4 text-muted-foreground" />;
  return (
    <span className="inline-flex shrink-0 items-center justify-center">
      <LobeProviderIcon provider={provider} size={size} type="color" />
    </span>
  );
}

function compactModelLabel(model: string) {
  return model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
}

export default function AI_Input_Search({
  value,
  models,
  selectedModel,
  reasoningLevel,
  reasoningSupported = false,
  placeholder = "How can I help you today?",
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
    minHeight: 88,
    maxHeight: 320,
  });

  const selectedOption =
    models.length === 0
      ? ({ value: "", label: "No API models" } satisfies PromptModelOption)
      : models.find((m) => m.value === selectedModel) ??
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
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Textarea */}
      <Textarea
        ref={textareaRef}
        id="operon-ai-prompt"
        value={value}
        disabled={disabled || isLoading}
        placeholder={placeholder}
        rows={1}
        className="min-h-22 w-full resize-none rounded-none border-0 bg-transparent px-4 pt-4 pb-1 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 shadow-none focus-visible:ring-0 disabled:cursor-not-allowed"
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        {/* Left controls */}
        <div className="flex items-center gap-0.5">
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
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <Paperclip className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Attach file</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || isLoading || models.length === 0}
                className="h-8 gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-foreground/80 hover:text-foreground"
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={selectedOption.value}
                    className="flex min-w-0 items-center gap-1.5"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                  >
                    <ModelProviderIcon modelValue={selectedOption.value} providerLabel={selectedOption.providerLabel} size={14} />
                    <span className="max-w-36 truncate">{selectedOption.label}</span>
                    <ChevronDown className="size-3 shrink-0 opacity-50" />
                  </motion.span>
                </AnimatePresence>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="max-h-80 min-w-72 overflow-y-auto rounded-xl p-1.5">
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.value}
                  className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2"
                  onSelect={() => onModelChange(model.value)}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background shadow-xs">
                      <ModelProviderIcon modelValue={model.value} providerLabel={model.providerLabel} size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{model.label}</p>
                      {model.providerLabel && (
                        <p className="truncate text-[11px] text-muted-foreground">{model.providerLabel}</p>
                      )}
                    </div>
                  </div>
                  {selectedModel === model.value && <Check className="size-3.5 shrink-0 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || isLoading}
                      className={cn(
                        "h-8 gap-1.5 rounded-full px-2.5 text-[13px] font-medium",
                        reasoningSupported
                          ? "text-foreground/80 hover:text-foreground"
                          : "text-foreground/60 hover:text-foreground",
                      )}
                    >
                      <BrainCircuit className="size-3.5" />
                      <span className="hidden sm:inline">
                        {reasoningLabels[reasoningLevel]}
                      </span>
                      <ChevronDown className="size-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                </span>
              </TooltipTrigger>
              {!reasoningSupported && (
                <TooltipContent side="top">
                  This model may ignore the thinking budget
                </TooltipContent>
              )}
            </Tooltip>
            <DropdownMenuContent align="start" side="top" className="min-w-40 rounded-xl p-1.5">
              {(["auto", "low", "medium", "high"] as ReasoningLevel[]).map((lvl) => (
                <DropdownMenuItem
                  key={lvl}
                  className="flex items-center justify-between gap-2 rounded-lg"
                  onSelect={() => onReasoningLevelChange(lvl)}
                >
                  <span>{reasoningLabels[lvl]}</span>
                  {reasoningLevel === lvl && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isLoading ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Stop generating"
                onClick={onStop}
                className="size-8 shrink-0 rounded-full border-border/60"
              >
                <Square className="size-3.5 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Stop</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={disabled || !value.trim()}
            className={cn(
              "size-8 shrink-0 rounded-full transition-all",
              value.trim() && !disabled
                ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground/40",
            )}
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
