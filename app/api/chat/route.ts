import { smoothStream, stepCountIs, streamText, generateObject } from "ai";
import type { ModelMessage, UIMessage } from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { textFromParts, toModelMessages } from "@/lib/ai/convert";
import { getChatModel } from "@/lib/ai/provider";
import { OPERON_SYSTEM_PROMPT, buildCapabilitySnapshot } from "@/lib/ai/system-prompt";
import { buildAvailableTools } from "@/lib/ai/tools/registry";
import { autoExtractMemory } from "@/lib/ai/memory-extractor";
import { memory } from "@/lib/memory";
import { buildPersonaSystemPrompt, getPersonaForChannel } from "@/lib/services/user-settings";
import { appendMessage, createConversation, deleteConversation, getConversation, listConversations, updateConversationTitle } from "@/lib/services/chat-store";
import { appendLog } from "@/lib/services/logs";
import type { Channel } from "@/lib/types";

export const maxDuration = 60;

/** Generate a short 4-6 word conversation title from the first exchange. */
async function generateConversationTitle(
  userId: string,
  userText: string,
  assistantText: string,
): Promise<string | null> {
  try {
    const result = await generateObject({
      model: await getChatModel(userId),
      schema: z.object({ title: z.string().min(3).max(60) }),
      system:
        "Generate a short (4-6 word) conversation title based on the exchange. " +
        "Be specific — capture the actual topic (e.g. 'Set Up GitHub Actions CI' not 'GitHub Help'). " +
        "Title Case. No punctuation at end.",
      prompt: `User: ${userText.slice(0, 300)}\nAssistant: ${assistantText.slice(0, 300)}`,
    });
    return result.object.title;
  } catch {
    return null;
  }
}

type ReasoningLevel = "auto" | "low" | "medium" | "high";

// Local JSON-serializable type alias — structurally identical to the AI SDK's
// JSONObject / SharedV3ProviderOptions so we can return correctly-typed provider option maps.
type JSONVal = string | number | boolean | null | JSONVal[] | { [k: string]: JSONVal };
type ProviderOptionMap = Record<string, Record<string, JSONVal>>;

function providerIdFromSpec(modelSpec: string | null) {
  if (!modelSpec || !modelSpec.includes("/")) return null;
  return modelSpec.slice(0, modelSpec.indexOf("/"));
}

function modelSupportsReasoning(modelSpec: string | null) {
  if (!modelSpec || !modelSpec.includes("/")) return false;
  const slashIndex = modelSpec.indexOf("/");
  const providerId = modelSpec.slice(0, slashIndex);
  const modelId = modelSpec.slice(slashIndex + 1).toLowerCase();
  if (providerId === "openai") return /^o\d/.test(modelId);
  if (providerId === "anthropic") {
    return (
      modelId.includes("3-7") ||
      modelId.startsWith("claude-sonnet-4") ||
      modelId.startsWith("claude-opus-4") ||
      modelId.startsWith("claude-haiku-4") ||
      modelId.startsWith("claude-4")
    );
  }
  if (providerId === "google") return modelId.startsWith("gemini-2.5") || modelId.startsWith("gemini-3");
  return false;
}

function reasoningProviderOptions(
  modelSpec: string | null,
  reasoningLevel: ReasoningLevel,
): ProviderOptionMap | undefined {
  if (reasoningLevel === "auto") return undefined;
  if (!modelSupportsReasoning(modelSpec)) return undefined;

  const providerId = providerIdFromSpec(modelSpec);

  if (providerId === "openai") {
    return {
      openai: {
        reasoningEffort: reasoningLevel,
        reasoningSummary: "auto",
      },
    };
  }

  if (providerId === "anthropic") {
    // claude-3-7 and claude-4 support extended thinking via budgetTokens
    const budgetTokens =
      reasoningLevel === "low" ? 2048 : reasoningLevel === "medium" ? 8192 : 32000;
    return {
      anthropic: {
        thinking: { type: "enabled", budgetTokens },
      },
    };
  }

  if (providerId === "google") {
    // gemini-2.5+ supports thinkingConfig.thinkingLevel
    return {
      google: {
        thinkingConfig: { thinkingLevel: reasoningLevel }, // "low" | "medium" | "high"
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
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

export async function PATCH(req: Request) {
  const userId = await userIdOf();
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : null;
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  await updateConversationTitle(id, userId, title);
  await appendLog({ userId, level: "info", source: "chat", message: "Conversation renamed", metadata: { conversationId: id, title } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const messages: { id: string; role: "user" | "assistant"; parts: Array<{ type: "text"; text: string }> }[] =
    (body.messages || []).map((m: { _id?: string; role: string; parts?: Array<{ type: string; text?: string }> }, i: number) => ({
      id: m._id ?? `msg-${i}`,
      role: m.role as "user" | "assistant",
      parts: (m.parts || []).map((p) => ({ type: "text" as const, text: p.text || "" })),
    }));
  const conversationId: string | null = body.conversationId || null;
  const modelSpec: string | null = body.modelSpec || null;
  const reasoningLevel: ReasoningLevel = ["low", "medium", "high"].includes(body.reasoningLevel)
    ? body.reasoningLevel
    : "auto";
  const userId = await userIdOf();
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  // Build full model message history from DB for multi-turn context
  let fullModelMessages: ModelMessage[] = modelMessages;
  if (conversationId) {
    try {
      const histConv = await getConversation(conversationId, userId);
      if (histConv?.messages && histConv.messages.length > 1) {
        const uiMessages = histConv.messages
          .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: (Array.isArray(m.parts) && m.parts.length > 0)
              ? m.parts as UIMessage["parts"]
              : [{ type: "text" as const, text: m.content || "" }],
          })) as UIMessage[];
        fullModelMessages = await toModelMessages(uiMessages);
      }
    } catch {
      // History load failed — fall back to current message only
    }
  }
  const persona = await getPersonaForChannel(userId, body.channel ?? "web");
  const [memoryContext, snap] = await Promise.all([
    persona.memoryEnabled
      ? memory.context(userId, lastUserText, 8, { depth: persona.memoryDepth })
      : Promise.resolve(""),
    buildCapabilitySnapshot(userId),
  ]);

  // Build dynamic prefix: inject top memories + first-run directive + workspace files
  // Note: workspaceFilesSection is already embedded in snap.text (OPERATOR CONTEXT block)
  const isFirstConversation = snap.conversationCount === 0;
  const hasStoredMemory = snap.memoryCount > 0;
  const dynamicPrefixParts: string[] = [snap.text];

  if (isFirstConversation && hasStoredMemory) {
    // First conversation but has memory — user returned after wipe or new session
    dynamicPrefixParts.push(
      `\nNote: This operator has ${snap.memoryCount} prior memory fact(s) stored — but no conversation history. ` +
      "This means you've met before. Try to recall relevant facts naturally."
    );
  }

  if (snap.topMemories.length > 0) {
    dynamicPrefixParts.push(
      "Key things you already know about this operator:\n" + snap.topMemories.join("\n")
    );
  }

  if (isFirstConversation) {
    const name = persona.userNickname || null;
    if (name) {
      dynamicPrefixParts.push(
        `FIRST-RUN: Greet the operator by name ("Hey ${name} — welcome back"). You know their name.`
      );
    } else {
      dynamicPrefixParts.push(
        "FIRST-RUN: Warmly introduce yourself as Operon. Ask what to call them, then use that name going forward."
      );
    }
  }

const capabilitySnapshot = dynamicPrefixParts.join("\n");
  const personaPrompt = buildPersonaSystemPrompt(persona);

  // Inject current date/time using the user's saved timezone
  const tz = persona.timezone || "UTC";
  let dateTimeContext = "";
  try {
    const now = new Date();
    const localTime = now.toLocaleString("en-US", {
      timeZone: tz,
      weekday: "short", year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const utcTime = now.toISOString().slice(0, 16).replace("T", " ") + " UTC";
    dateTimeContext = `DATE/TIME CONTEXT:\n- User's local time: ${localTime} (${tz})\n- UTC: ${utcTime}`;
  } catch { /* invalid tz — skip */ }

  const systemPrompt = [OPERON_SYSTEM_PROMPT, capabilitySnapshot, dateTimeContext, personaPrompt, memoryContext].filter(Boolean).join("\n\n");
  const tools = await buildAvailableTools(userId);

  const result = streamText({
    model: await getChatModel(userId, modelSpec ?? undefined, persona.model),
    tools,
    system: systemPrompt,
    messages: fullModelMessages,
    providerOptions: reasoningProviderOptions(modelSpec, reasoningLevel),
    temperature: persona.temperature,
    topP: persona.topP,
    maxOutputTokens: persona.maxTokens && persona.maxTokens > 0 ? persona.maxTokens : undefined,
    frequencyPenalty: persona.frequencyPenalty,
    presencePenalty: persona.presencePenalty,
    stopWhen: stepCountIs(8),
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

  // ---------------------------------------------------------------------------
  // Transform AI SDK chunks into our custom NDJSON event stream
  // ---------------------------------------------------------------------------
  const persistedParts: unknown[] = [];
  const persistedToolIndex = new Map<string, number>();
  let persistedReasoningText = "";
  let persistedAssistantText = "";

  function pushPersistedPart(part: Record<string, unknown>) {
    persistedParts.push(part);
  }

  function updatePersistedTool(toolCallId: string, partial: Record<string, unknown>) {
    const index = persistedToolIndex.get(toolCallId);
    if (index === undefined) return;
    persistedParts[index] = { ...(persistedParts[index] as Record<string, unknown>), ...partial };
  }

  function rememberChunk(chunk: { type: string; [key: string]: unknown }) {
    switch (chunk.type) {
      case "reasoning-start":
        persistedReasoningText = "";
        pushPersistedPart({ type: "reasoning-start", text: "" });
        break;
      case "reasoning-delta": {
        persistedReasoningText += String(chunk.delta ?? "");
        const last = persistedParts[persistedParts.length - 1] as Record<string, unknown> | undefined;
        if (last?.type === "reasoning-delta") {
          persistedParts[persistedParts.length - 1] = { ...last, text: persistedReasoningText };
        } else {
          pushPersistedPart({ type: "reasoning-delta", text: persistedReasoningText });
        }
        break;
      }
      case "reasoning-end":
        pushPersistedPart({ type: "reasoning-end", text: persistedReasoningText });
        break;
      case "tool-call": {
        const toolCallId = String(chunk.toolCallId ?? crypto.randomUUID());
        persistedToolIndex.set(toolCallId, persistedParts.length);
        pushPersistedPart({
          type: "tool-call-start",
          toolCallId,
          toolName: String(chunk.toolName ?? "tool"),
          state: "calling",
          args: chunk.args ?? chunk.input ?? {},
        });
        break;
      }
      case "tool-input-start":
        updatePersistedTool(String(chunk.toolCallId ?? ""), { type: "tool-call-input-streaming", state: "input-streaming" });
        break;
      case "tool-input-delta":
        updatePersistedTool(String(chunk.toolCallId ?? ""), { type: "tool-call-input-streaming", state: "input-streaming", args: { _delta: String(chunk.delta ?? "") } });
        break;
      case "tool-input-end":
        updatePersistedTool(String(chunk.toolCallId ?? ""), { type: "tool-call-execute", state: "executing" });
        break;
      case "tool-result":
        updatePersistedTool(String(chunk.toolCallId ?? ""), { type: "tool-call-output-available", state: "output-available", result: chunk.output ?? null });
        break;
      case "tool-error":
        updatePersistedTool(String(chunk.toolCallId ?? ""), { type: "tool-call-output-error", state: "output-error", errorText: chunk.error ? String(chunk.error) : "Tool error" });
        break;
      case "source":
        pushPersistedPart({ type: "source-url", url: String(chunk.url ?? ""), title: chunk.title ? String(chunk.title) : undefined });
        break;
      case "text-delta": {
        const text = String(chunk.delta ?? "");
        persistedAssistantText += text;
        pushPersistedPart({ type: "text-delta", text });
        break;
      }
    }
  }

  function chunkToEvent(chunk: { type: string; [key: string]: unknown }): string | null {
    switch (chunk.type) {
      case "reasoning-start":
        return JSON.stringify({ type: "reasoning-start", data: {} });
      case "reasoning-delta":
        return JSON.stringify({ type: "reasoning-delta", data: { text: String(chunk.delta ?? "") } });
      case "reasoning-end":
        return JSON.stringify({ type: "reasoning-end", data: {} });
      case "tool-call":
        return JSON.stringify({
          type: "tool-call-start",
          data: { toolCallId: String(chunk.toolCallId ?? ""), toolName: String(chunk.toolName ?? ""), args: chunk.args ?? chunk.input ?? {} },
        });
      case "tool-input-start":
        return JSON.stringify({ type: "tool-call-input-streaming", data: { toolCallId: String(chunk.toolCallId ?? "") } });
      case "tool-input-delta":
        return JSON.stringify({ type: "tool-call-input-streaming", data: { toolCallId: String(chunk.toolCallId ?? ""), args: { _delta: String(chunk.delta ?? "") } } });
      case "tool-input-end": {
        const id = String(chunk.toolCallId ?? "");
        // Emit input-available then execute so UI shows both states
        return (
          JSON.stringify({ type: "tool-call-input-available", data: { toolCallId: id } }) +
          `\ndata: ` +
          JSON.stringify({ type: "tool-call-execute", data: { toolCallId: id } })
        );
      }
      case "tool-result":
        return JSON.stringify({ type: "tool-call-output-available", data: { toolCallId: String(chunk.toolCallId ?? ""), result: chunk.output ?? null } });
      case "tool-error":
        return JSON.stringify({ type: "tool-call-output-error", data: { toolCallId: String(chunk.toolCallId ?? ""), errorText: chunk.error ? String(chunk.error) : "Tool error" } });
      case "source":
        return JSON.stringify({ type: "source-url", data: { url: String(chunk.url ?? ""), title: chunk.title ? String(chunk.title) : undefined } });
      case "text-delta":
        return JSON.stringify({ type: "text-delta", data: { text: String(chunk.delta ?? "") } });
      case "data-file":
        return null;
      default:
        return null;
    }
  }

  const encoder = new TextEncoder();
  const customStream = new ReadableStream({
    async start(controller) {
      try {
        const uiStream = result.toUIMessageStream({ originalMessages: messages, sendReasoning: true, sendSources: true, sendFinish: false });
        for await (const chunk of uiStream) {
          const typedChunk = chunk as { type: string; [key: string]: unknown };
          rememberChunk(typedChunk);
          const ev = chunkToEvent(typedChunk);
          if (ev) controller.enqueue(encoder.encode(`data: ${ev}\n`));
        }
        if (conversationId) {
          await appendMessage(conversationId, userId, {
            role: "assistant",
            content: persistedAssistantText,
            createdAt: new Date().toISOString(),
            parts: persistedParts,
          });
          await appendLog({
            userId,
            level: "info",
            source: "chat",
            message: "Assistant message persisted",
            metadata: { conversationId, parts: persistedParts.length, textLength: persistedAssistantText.length },
          });
        }
        if (persona.memoryEnabled && lastUserText) {
          const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;
          void autoExtractMemory({ userId, userText: lastUserText, assistantText: persistedAssistantText, isFirstMessage });
        }
        if (conversationId && messages.filter((m) => m.role === "user").length === 1 && lastUserText) {
          void generateConversationTitle(userId, lastUserText, persistedAssistantText).then((title) => { if (title) return updateConversationTitle(conversationId, userId, title); });
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "message-end", data: {} })}\n`));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(customStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}