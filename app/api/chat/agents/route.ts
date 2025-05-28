import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage } from "ai";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import '@/app/utils/fetch'; // Import fetch implementation

export const runtime = "edge";

const TEMPLATE = `You are Ubumuntu AI, a personal AI assistant. You have access to several tools to help users:

Core Capabilities:
- Analyze documents and extract information (use "document_analysis" tool)
- Execute database queries and get insights (use "database_query" tool)
- Generate images from descriptions (use "image_generator" tool)
- Execute and explain code (use "code_interpreter" tool)

Instructions:
1. Use the provided tools when relevant to the user's request
2. If no tool is needed, respond directly using your knowledge
3. Format responses in markdown with clear sections
4. Always provide context and explanations for tool outputs

Chat History:
{history}

User's query: {query}`;

const prompt = PromptTemplate.fromTemplate(TEMPLATE);

function formatMessage(message: VercelChatMessage) {
  return `${message.role}: ${message.content}`;
}

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];

    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;

    const model = await initializeGeminiModel({
      maxOutputTokens: 2048,
      temperature: 0.7,
    });

    const chain = RunnableSequence.from([
      {
        history: () => formattedPreviousMessages.join("\n"),
        query: () => currentMessageContent,
      },
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({});

    return NextResponse.json({
      messages: [
        ...messages,
        {
          role: "assistant",
          content: response.trim()
        }
      ]
    });
  } catch (error) {
    console.error("Error in chat route:", error);
    return NextResponse.json(
      { error: "There was an error processing your request" },
      { status: 500 }
    );
  }
}
