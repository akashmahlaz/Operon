import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface TextPartProps {
  text: string;
  isUser?: boolean;
}

export function TextPart({ text, isUser }: TextPartProps) {
  if (!text) return null;

  if (isUser) {
    return (
      <div className="max-w-[80%] rounded-3xl bg-secondary px-4 py-2.5">
        <p className="whitespace-pre-wrap wrap-break-word text-[14.5px] leading-relaxed text-foreground">
          {text}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none wrap-break-word leading-relaxed text-foreground",
        "prose-headings:font-heading prose-headings:text-foreground prose-p:my-1.5",
        "prose-code:rounded-md prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:text-foreground",
        "prose-code:before:content-none prose-code:after:content-none prose-pre:my-2 prose-pre:rounded-xl prose-pre:bg-muted prose-pre:text-foreground",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      )}
    >
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
    </div>
  );
}
