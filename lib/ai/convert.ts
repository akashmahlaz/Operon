import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

export function textFromParts(parts: UIMessage["parts"] | undefined) {
  return (parts || [])
    .filter((part) => (part as { type?: string }).type === "text")
    .map((part) => (part as { text?: string }).text || "")
    .join("");
}

export async function toModelMessages(messages: UIMessage[]): Promise<ModelMessage[]> {
  return convertToModelMessages(messages, { ignoreIncompleteToolCalls: true });
}
