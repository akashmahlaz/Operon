import { minimax } from "vercel-minimax-ai-provider";

export const DEFAULT_CHAT_MODEL = "MiniMax-M2.7";

export function getChatModel(modelId = DEFAULT_CHAT_MODEL) {
  return minimax(modelId);
}
