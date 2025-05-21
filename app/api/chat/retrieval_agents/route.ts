import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseMessage } from "@langchain/core/messages";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { StructuredTool } from "@langchain/core/tools";
import { DynamicTool } from "langchain/tools";
import { formatDocumentsAsString } from "langchain/util/document";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { z } from "zod";

export const runtime = "edge";

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new SystemMessage(message.content);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { role: "user", content: message.content };
  } else if (message._getType() === "ai") {
    return { role: "assistant", content: message.content };
  } else {
    return { role: "system", content: message.content };
  }
};

// Custom Pinecone retriever using fetch API instead of Node.js SDK
async function searchPineconeViaAPI(query: string, topK = 5) {
  // Get embedding for the query
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY || "",
    modelName: "embedding-latest",
  });
  
  const queryEmbedding = await embeddings.embedQuery(query);
  
  // Query Pinecone via REST API
  const pineconeEndpoint = `https://${process.env.PINECONE_INDEX}-${process.env.PINECONE_PROJECT}.svc.${process.env.PINECONE_ENVIRONMENT}.pinecone.io/query`;
  
  const response = await fetch(pineconeEndpoint, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinecone API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Convert Pinecone response to Document objects
  return data.matches.map((match: any) => {
    return new Document({
      pageContent: match.metadata.text || "No content available",
      metadata: {
        source: match.metadata.source || "unknown",
        score: match.score,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;

    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-latest",
    });

    // Create a custom retriever that implements BaseRetriever
    class CustomPineconeRetriever extends BaseRetriever {
      lc_namespace = ["langchain", "retrievers", "pinecone"];
      
      constructor() {
        super();
      }

      async _getRelevantDocuments(query: string) {
        return await searchPineconeViaAPI(query);
      }
    }

    const retriever = new CustomPineconeRetriever();

    class SearchTool extends StructuredTool {
      name = "search";
      description =
        "Search for information about a topic. Input should be a search query.";
      schema = z.object({
        query: z.string().describe("The search query to use"),
      });

      async _call({ query }: { query: string }) {
        const docs = await retriever.getRelevantDocuments(query);
        return formatDocumentsAsString(docs);
      }
    }

    const tools = [new SearchTool()];

    const prompt = PromptTemplate.fromTemplate(`
      You are a helpful AI assistant that answers questions based on the provided context. If you 
      don't know something or it's not mentioned in the context, just say so.
      
      Context: {context}
      
      Question: {question}
      
      Answer:
    `);

    const chain = RunnableSequence.from([
      {
        question: (input) => input.question,
        context: async (input) => {
          const docs = await retriever.getRelevantDocuments(input.question);
          return formatDocumentsAsString(docs);
        },
      },
      prompt,
      chatModel,
      new StringOutputParser(),
    ]);

    const currentMessageContent = messages[messages.length - 1].content;
    const stream = await chain.stream({
      question: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Error in retrieval agent:", error);
    return NextResponse.json(
      { error: "Error processing your request" },
      { status: 500 }
    );
  }
}
