import { NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { PromptTemplate } from "@langchain/core/prompts";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import '@/app/utils/fetch'; // Import fetch implementation

export const runtime = "edge";

const TEMPLATE = `Extract the requested fields from the input.

The field "entity" refers to the first mentioned entity in the input.

Input:

{input}`;

/**
 * This handler initializes and calls a structured output chain.
 * See the docs for more information:
 *
 * https://js.langchain.com/docs/modules/model_io/output_parsers/structured
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const currentMessageContent = messages[messages.length - 1].content;

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);
    const model = await initializeGeminiModel({
      maxOutputTokens: 2048,
      temperature: 0.8,
    });

    /**
     * We use Zod (https://zod.dev) to define our schema for convenience,
     * but you can pass JSON schema if desired.
     */
    const schema = z
      .object({
        tone: z
          .enum(["positive", "negative", "neutral"])
          .describe("The overall tone of the input"),
        entity: z.string().describe("The entity mentioned in the input"),
        word_count: z.number().describe("The number of words in the input"),
        chat_response: z.string().describe("A response to the human's input"),
        final_punctuation: z
          .optional(z.string())
          .describe("The final punctuation mark in the input, if any."),
      })
      .describe("Should always be used to properly format output");

    /**
     * Bind schema to the model.
     * Future invocations of the returned model will always match the schema.
     */
    const functionCallingModel = model.withStructuredOutput(schema, {
      name: "output_formatter",
    });

    /**
     * Returns a chain with the function calling model.
     */
    const chain = prompt.pipe(functionCallingModel);

    const result = await chain.invoke({
      input: currentMessageContent,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
