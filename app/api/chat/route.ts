import { smoothStream, stepCountIs, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { textFromParts, toModelMessages } from "@/lib/ai/convert";
import { getChatModel } from "@/lib/ai/provider";
import { OPERON_SYSTEM_PROMPT, buildCapabilitySnapshot } from "@/lib/ai/system-prompt";
import { buildAvailableTools } from "@/lib/ai/tools/registry";
import { autoExtractMemory } from "@/lib/ai/memory-extractor";
import { memory } from "@/lib/memory";
import { buildPersonaSystemPrompt, getPersonaForChannel } from "@/lib/services/user-settings";
import { appendMessage, createConversation, deleteConversation, getConversation, listConversations } from "@/lib/services/chat-store";
import { appendLog } from "@/lib/services/logs";
import type { Channel } from "@/lib/types";

export const maxDuration = 60;

type ReasoningLevel = "auto" | "low" | "medium" | "high";

function providerIdFromSpec(modelSpec: string | null) {
  if (!modelSpec || !modelSpec.includes("/")) return null;
  return modelSpec.slice(0, modelSpec.indexOf("/"));
}

function reasoningProviderOptions(
  providerId: string | null,
  reasoningLevel: ReasoningLevel,
): Record<string, Record<string, string>> | undefined {
  if (reasoningLevel === "auto") return undefined;

  if (providerId === "openai") {
    return {
      openai: {
        reasoningEffort: reasoningLevel,
        reasoningSummary: "auto",
      },
    };
  }

  if (providerId === "anthropic") {
    return {
      anthropic: {
        effort: reasoningLevel,
      },
    };
  }

  return undefined;
}

async function userIdOf(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "anon";
  return (session.user as { id?: string }).id || session.user.email || "anon";
}

export async function GET(req: Request) {
  const userId = await userIdOf();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const conv = await getConversation(id, userId);
    if (!conv)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(conv);
  }

  return NextResponse.json(await listConversations(userId));
}

export async function PUT(req: Request) {
  const userId = await userIdOf();
  const body = await req.json().catch(() => ({}));
  const conv = await createConversation({
    userId,
    title: typeof body?.title === "string" ? body.title : "New Chat",
    channel: typeof body?.channel === "string" ? (body.channel as Channel) : "web",
  });
  await appendLog({
    userId,
    level: "info",
    source: "chat",
    message: "Conversation created",
    metadata: { conversationId: conv._id, channel: conv.channel },
  });
  return NextResponse.json(conv);
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteConversation(id, userId);
  await appendLog({
    userId,
    level: "info",
    source: "chat",
    message: "Conversation deleted",
    metadata: { conversationId: id },
  });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json();
  const messages: UIMessage[] = body.messages || [];
  const conversationId: string | null = body.conversationId || null;
  const modelSpec: string | null = body.modelSpec || null;
  const reasoningLevel: ReasoningLevel = ["low", "medium", "high"].includes(body.reasoningLevel)
    ? body.reasoningLevel
    : "auto";
  const userId = await userIdOf();

  if (conversationId) {
    const last = messages[messages.length - 1];
    if (last?.role === "user") {
      const text = textFromParts(last.parts);
      await appendMessage(conversationId, userId, {
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        parts: last.parts as unknown[],
      });
      await appendLog({
        userId,
        level: "info",
        source: "chat",
        message: "User message persisted",
        metadata: { conversationId, parts: last.parts?.length ?? 0 },
      });
    }
  }

  const modelMessages = await toModelMessages(messages);
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const lastUserText = lastUserMessage ? textFromParts(lastUserMessage.parts) : "";
  const persona = await getPersonaForChannel(userId, body.channel ?? "web");
  const [memoryContext, capabilitySnapshot] = await Promise.all([
    persona.memoryEnabled
      ? memory.context(userId, lastUserText, 8, { depth: persona.memoryDepth })
      : Promise.resolve(""),
    buildCapabilitySnapshot(userId),
  ]);
  const personaPrompt = buildPersonaSystemPrompt(persona);
  const systemPrompt = [OPERON_SYSTEM_PROMPT, capabilitySnapshot, personaPrompt, memoryContext].filter(Boolean).join("\n\n");
  const tools = await buildAvailableTools(userId);

  const result = streamText({
    model: await getChatModel(userId, modelSpec ?? undefined),
    tools,
    system: systemPrompt,
    messages: modelMessages,
    providerOptions: reasoningProviderOptions(providerIdFromSpec(modelSpec), reasoningLevel),
    stopWhen: stepCountIs(8),
    // Word-level smoothing: providers that emit large chunks (e.g. minimax,
    // some OpenAI-compatible gateways) otherwise look like blocking UIs.
    // smoothStream rechunks the stream so the UI shows a typewriter effect.
    experimental_transform: smoothStream({ delayInMs: 18, chunking: "word" }),
    experimental_onToolCallFinish: async (event) => {
      await appendLog({
        userId,
        level: event.success ? "info" : "error",
        source: "ai-tool",
        message: event.success ? "Tool call completed" : "Tool call failed",
        metadata: {
          conversationId,
          tool: event.toolCall.toolName,
          durationMs: event.durationMs,
          success: event.success,
          error: event.success ? undefined : event.error instanceof Error ? event.error.message : String(event.error),
        },
      });
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    sendSources: true,
    onFinish: async ({ responseMessage }) => {
      const assistantText = textFromParts(responseMessage.parts);
      if (conversationId) {
        await appendMessage(conversationId, userId, {
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
          parts: responseMessage.parts as unknown[],
        });
        await appendLog({
          userId,
          level: "info",
          source: "chat",
          message: "Assistant message persisted",
          metadata: { conversationId, parts: responseMessage.parts.length },
        });
      }
      if (persona.memoryEnabled && lastUserText) {
        // Fire-and-forget: do not block stream completion on extraction.
        const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;
        void autoExtractMemory({ userId, userText: lastUserText, assistantText, isFirstMessage });
      }
    },
  });
}