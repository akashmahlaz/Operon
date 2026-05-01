import { getConversation, listConversations } from "@/lib/services/chat-store";

export async function listSessions(userId: string) {
  return listConversations(userId);
}

export async function getSession(userId: string, id: string) {
  return getConversation(id, userId);
}
