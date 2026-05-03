import { collections } from "@/lib/db-collections";
import type { Channel, ConversationDetail, MessageRole } from "@/lib/types";
import type { Document } from "mongodb";

export interface StoredConversation extends Document {
  _id: string;
  userId: string;
  title: string;
  channel: Channel;
  lastMessage: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage extends Document {
  _id: string;
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: string;
  parts: unknown[];
  createdAt: string;
}

export type NewChatMessage = Pick<StoredMessage, "role" | "content" | "parts" | "createdAt">;

const conversations = () => collections.conversations<StoredConversation>();
const messages = () => collections.messages<StoredMessage>();

let indexesReady: Promise<void> | null = null;

function ensureIndexes() {
  indexesReady ??= Promise.all([
    conversations().createIndex({ userId: 1, updatedAt: -1 }),
    conversations().createIndex({ _id: 1, userId: 1 }),
    messages().createIndex({ conversationId: 1, createdAt: 1 }),
    messages().createIndex({ userId: 1, createdAt: -1 }),
  ]).then(() => undefined);
  return indexesReady;
}

function nowIso() {
  return new Date().toISOString();
}

function toSummary(conversation: StoredConversation) {
  return {
    ...conversation,
    id: conversation._id,
    preview: conversation.lastMessage ?? undefined,
  };
}

export async function listConversations(userId: string) {
  await ensureIndexes();
  const rows = await conversations()
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
  return rows.map(toSummary);
}

export async function getConversation(conversationId: string, userId: string): Promise<ConversationDetail | null> {
  await ensureIndexes();
  const conversation = await conversations().findOne({ _id: conversationId, userId });
  if (!conversation) return null;

  const messageRows = await messages()
    .find({ conversationId, userId })
    .sort({ createdAt: 1 })
    .toArray();

  return {
    ...conversation,
    messages: messageRows.map((message) => ({
      id: message._id,
      _id: message._id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt: message.createdAt,
    })),
  };
}

export async function createConversation({
  userId,
  title = "New Chat",
  channel = "web",
}: {
  userId: string;
  title?: string;
  channel?: Channel;
}) {
  await ensureIndexes();
  const createdAt = nowIso();
  const conversation: StoredConversation = {
    _id: crypto.randomUUID(),
    userId,
    title,
    channel,
    lastMessage: null,
    messageCount: 0,
    createdAt,
    updatedAt: createdAt,
  };

  await conversations().insertOne(conversation);
  return { ...conversation, messages: [] };
}

export async function deleteConversation(conversationId: string, userId: string) {
  await ensureIndexes();
  await Promise.all([
    conversations().deleteOne({ _id: conversationId, userId }),
    messages().deleteMany({ conversationId, userId }),
  ]);
}

export async function updateConversationTitle(conversationId: string, userId: string, title: string) {
  await ensureIndexes();
  await conversations().updateOne(
    { _id: conversationId, userId },
    { $set: { title: title.trim().slice(0, 80), updatedAt: nowIso() } },
  );
}

export async function appendMessage(conversationId: string, userId: string, message: NewChatMessage) {
  await ensureIndexes();
  const existing = await conversations().findOne({ _id: conversationId, userId });
  if (!existing) return null;

  const messageDocument: StoredMessage = {
    _id: crypto.randomUUID(),
    conversationId,
    userId,
    role: message.role,
    content: message.content,
    parts: message.parts,
    createdAt: message.createdAt,
  };

  const titleUpdate =
    message.role === "user" && existing.title === "New Chat" && message.content.trim()
      ? { title: message.content.trim().slice(0, 60) }
      : {};

  await Promise.all([
    messages().insertOne(messageDocument),
    conversations().updateOne(
      { _id: conversationId, userId },
      {
        $set: {
          ...titleUpdate,
          lastMessage: message.content.slice(0, 140),
          updatedAt: message.createdAt,
        },
        $inc: { messageCount: 1 },
      },
    ),
  ]);

  return messageDocument;
}