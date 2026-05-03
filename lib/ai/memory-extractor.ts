import { generateObject } from "ai";
import { z } from "zod";
import { getChatModel } from "@/lib/ai/provider";
import { memory } from "@/lib/memory";
import { getPersona, setPersona } from "@/lib/services/user-settings";
import { appendLog } from "@/lib/services/logs";

const extractionSchema = z.object({
  facts: z
    .array(
      z.object({
        content: z.string().min(3).max(280),
        kind: z.enum(["preference", "fact", "project", "instruction"]),
        importance: z.number().int().min(1).max(5),
      }),
    )
    .max(5),
});

const EXTRACTOR_SYSTEM = [
  "You extract durable user facts from a chat exchange to store as long-term memory.",
  "Only return items that are stable about the USER (preferences, identity, ongoing projects, instructions on how to be helped).",
  "Skip transient questions, current task details, conversational filler, anything time-bound, and ANY credentials/tokens/secrets.",
  "Phrase each item as a short third-person statement about the user (e.g. 'Prefers TypeScript over JavaScript').",
  "Return zero items if nothing durable was learned.",
].join(" ");

const LANGUAGE_DETECT_SCHEMA = z.object({
  detected: z.enum(["en", "hi", "hinglish"]).nullable(),
});

/** Auto-set languagePreference when the user's first message is not English. */
async function maybeAutoSetLanguage(userId: string, userText: string) {
  try {
    const result = await generateObject({
      model: await getChatModel(userId),
      schema: LANGUAGE_DETECT_SCHEMA,
      system: "Detect the primary language of the text. Return 'en' for English, 'hi' for Hindi, 'hinglish' for mixed Hindi/English, or null if unclear/other.",
      prompt: userText.slice(0, 500),
    });
    const lang = result.object.detected;
    if (!lang || lang === "en") return;
    const persona = await getPersona(userId);
    // Only auto-set if still on default; don't override a deliberate user choice.
    if (persona.languagePreference !== "en") return;
    await setPersona(userId, { languagePreference: lang });
    await appendLog({ userId, level: "info", source: "memory", message: "Auto-set language from first message", metadata: { lang } });
  } catch {
    // non-critical
  }
}

export async function autoExtractMemory(params: {
  userId: string;
  userText: string;
  assistantText: string;
  isFirstMessage?: boolean;
}) {
  const { userId, userText, assistantText, isFirstMessage } = params;
  if (!userText.trim() || userText.length > 4000) return;

  // On first message, try to auto-detect language.
  if (isFirstMessage) void maybeAutoSetLanguage(userId, userText);

  try {
    const result = await generateObject({
      model: await getChatModel(userId),
      schema: extractionSchema,
      system: EXTRACTOR_SYSTEM,
      prompt: [
        `User said:\n${userText.slice(0, 2000)}`,
        `Assistant replied:\n${assistantText.slice(0, 1500)}`,
        "Extract durable user facts only. Return {facts: []} if none.",
      ].join("\n\n"),
    });
    for (const fact of result.object.facts) {
      try {
        await memory.add(userId, {
          content: fact.content,
          source: "auto",
          kind: fact.kind,
          importance: fact.importance,
        });
      } catch {
        // secret guard or dedupe — silently skip
      }
    }
    if (result.object.facts.length > 0) {
      await appendLog({
        userId,
        level: "info",
        source: "memory",
        message: "Auto-extracted memory",
        metadata: { count: result.object.facts.length },
      });
    }
  } catch (error) {
    await appendLog({
      userId,
      level: "warn",
      source: "memory",
      message: "Auto-extract failed",
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}
