import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { minimax } from 'vercel-minimax-ai-provider';

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: minimax("MiniMax-M2.7"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}