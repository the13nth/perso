import { StreamingTextResponse, Message } from "ai";
import { experimental_buildOpenAIMessages } from "ai/prompts";
import OpenAI from "openai";

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// IMPORTANT! Set the runtime to edge
export const runtime = "edge";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const prompt = [
    {
      role: "system" as const,
      content:
        "You are an AI assistant focused on helping African businesses grow and succeed. You provide strategic advice, market insights, and practical solutions tailored to the African context.",
    },
    ...experimental_buildOpenAIMessages(messages as Message[]),
  ];

  // Ask OpenAI for a streaming chat completion given the prompt
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    stream: true,
    messages: prompt,
  });

  // Transform the response into a readable stream
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          controller.enqueue(new TextEncoder().encode(content));
        }
      }
      controller.close();
    },
  });

  // Return the stream with the correct headers
  return new StreamingTextResponse(stream);
} 