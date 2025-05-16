import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { initializeGeminiModel } from "@/app/utils/modelInit";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are an expert business consultant specialized in African markets and business development. Your role is to assist African entrepreneurs and businesses using a combination of market knowledge and retrieved information. Your responses should be:

1. Market-Aware: Demonstrate understanding of local African markets, from West Africa to East Africa, North Africa to Southern Africa
2. Culturally Intelligent: Consider local business practices, cultural nuances, and regional differences
3. Practical & Actionable: Provide specific, implementable advice considering local resources and constraints
4. Data-Informed: Use current market data and trends when available
5. Compliance-Focused: Consider local regulations and compliance requirements
6. Growth-Oriented: Focus on sustainable business growth in the African context
7. Resource-Conscious: Suggest solutions that are feasible with available local resources
8. Network-Aware: Reference relevant local business networks, incubators, and support systems when appropriate

Key Areas of Expertise:
- Market entry strategies for African markets
- Local regulatory compliance and requirements
- Funding and investment opportunities
- Supply chain optimization in African contexts
- Regional business partnerships and networking
- Technology adoption and digital transformation
- Local talent acquisition and development
- Cross-border trade within Africa

Current conversation:
{chat_history}

User: {input}
AI:`;

/**
 * This handler initializes and calls a simple chain with a prompt,
 * chat model, and output parser. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#prompttemplate--llm--outputparser
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    const model = await initializeGeminiModel({
      maxOutputTokens: 2048,
      temperature: 0.8,
    });

    /**
     * Chat models stream message chunks rather than bytes, so this
     * output parser handles serialization and byte-encoding.
     */
    const outputParser = new HttpResponseOutputParser();

    /**
     * Can also initialize as:
     *
     * import { RunnableSequence } from "@langchain/core/runnables";
     * const chain = RunnableSequence.from([prompt, model, outputParser]);
     */
    const chain = prompt.pipe(model).pipe(outputParser);

    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
