import { File as FileIcon } from "lucide-react";
import type { ParsedAttachment } from "@/components/chat/message/types";

export function FilePart({ attachment }: { attachment: ParsedAttachment }) {
  if (attachment.type === "image") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-2xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-h-64 max-w-64 rounded-2xl object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-foreground transition-colors hover:bg-muted/70"
    >
      <FileIcon className="size-3.5" />
      <span className="max-w-40 truncate">{attachment.name}</span>
    </a>
  );
}

export function FilePartList({ attachments }: { attachments: ParsedAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
      {attachments.map((attachment, index) => (
        <FilePart key={`${attachment.url}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}
