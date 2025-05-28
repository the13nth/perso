import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { NextRequest } from 'next/server';

// Create a Gemini API client
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
  model: "gemini-pro",
  streaming: true,
});

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const stream = await model.stream([
    new SystemMessage(
      "You are an AI assistant focused on helping African businesses grow and succeed. You provide strategic advice, market insights, and practical solutions tailored to the African context."
    ),
    ...messages.map((m: unknown) =>
      new HumanMessage((m as { content: string }).content)
    ),
  ]);

  // Return the stream with the correct headers
  return new Response(stream);
} 