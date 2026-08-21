import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { chatModel } from "@/lib/llm";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, system }: { messages: UIMessage[]; system?: string } =
    await req.json();

  const result = streamText({
    model: chatModel(),
    system,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
