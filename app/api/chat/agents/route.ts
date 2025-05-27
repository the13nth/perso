import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage } from "ai";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Calculator } from "@langchain/community/tools/calculator";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import { DocumentAnalysisTool, WeatherTool, DatabaseQueryTool, ImageGeneratorTool, CodeInterpreterTool } from "@/lib/tools";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

const AGENT_SYSTEM_TEMPLATE = `You are an AI assistant with access to a variety of tools to help users.

IMPORTANT TOOL SELECTION GUIDELINES:
- For weather queries (forecast, temperature, conditions, etc.), ALWAYS use the "weather" tool first
- For calculations and math problems, use the "calculator" tool
- For document analysis and text processing, use the "document-analysis" tool
- For database queries, use the "database-query" tool
- For image generation, use the "image-generator" tool
- For code execution, use the "code-interpreter" tool
- Only use web search ("serpapi") if the information is not available through specialized tools

You can use tools to:
- Get real-time weather information for any location (use "weather" tool)
- Perform mathematical calculations
- Analyze document text and extract insights
- Query databases with natural language
- Generate images from descriptions
- Execute code to solve problems
- Search the web for information (as a last resort)

Think through what tools would be most helpful for solving the user's request and use them appropriately.
Always be helpful, accurate, and user-focused.`;

/**
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    // Initialize tools in priority order
    const tools = [
      new WeatherTool(),
      new Calculator(),
      new DocumentAnalysisTool(),
      new DatabaseQueryTool(),
      new ImageGeneratorTool(),
      new CodeInterpreterTool(),
    ];
    
    if (process.env.SERPAPI_API_KEY) {
      tools.push(new SerpAPI());
    }

    const chat = new ChatGoogleGenerativeAI({
      model: "gemini-pro",
      maxOutputTokens: 2048,
      temperature: 0,
    });

    /**
     * Use a prebuilt LangGraph agent.
     */
    const agent = createReactAgent({
      llm: chat,
      tools,
      /**
       * Modify the stock prompt in the prebuilt agent. See docs
       * for how to customize your agent:
       *
       * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
       */
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });

    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream" && data.chunk.content) {
              controller.enqueue(encoder.encode(data.chunk.content));
            }
          }
          controller.close();
        },
      });

      return new Response(stream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (error) {
    const status = error instanceof Error && 'status' in error ? error.status as number : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'An error occurred' }, { status });
  }
}
