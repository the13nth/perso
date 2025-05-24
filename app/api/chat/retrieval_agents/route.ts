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
import { auth } from "@clerk/nextjs/server";
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
async function searchPineconeViaAPI(query: string, userId: string, topK = 5) {
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
      filter: {
        // Only user's own content - no access to other users' content
        userId
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Pinecone API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Convert Pinecone response to Document objects
  return data.matches.map((match: any) => {
    // Extract full metadata
    const metadata = match.metadata || {};
    
    // Check if text is valid and sanitize if needed
    let text = "No content available";
    if (metadata.text) {
      text = typeof metadata.text === 'string' 
        ? metadata.text 
        : JSON.stringify(metadata.text).slice(0, 1000);
    }
    
    // Prepare source information
    let source = "Unknown source";
    if (metadata.documentId) {
      source = `Document ID: ${metadata.documentId}`;
      if (metadata.title) {
        source = `${metadata.title} (${source})`;
      }
      if (metadata.chunkIndex !== undefined && metadata.totalChunks !== undefined) {
        source += ` (Chunk ${metadata.chunkIndex + 1} of ${metadata.totalChunks})`;
      }
    }
    
    // Add categories if available
    let categories = "";
    if (metadata.categories && Array.isArray(metadata.categories) && metadata.categories.length > 0) {
      categories = `Categories: ${metadata.categories.join(", ")}`;
    }
    
    // Create the document with enhanced metadata
    return new Document({
      pageContent: text,
      metadata: {
        source,
        score: match.score,
        categories,
        access: metadata.access || "personal",
        createdAt: metadata.createdAt || "Unknown date",
        owner: metadata.userId === userId ? "You" : "Other user",
        documentId: metadata.documentId,
        title: metadata.title || "Untitled document",
      },
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];
    
    // Get the user ID from auth
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to use this feature" },
        { status: 401 }
      );
    }
    
    const formattedPreviousMessages = messages
      .slice(0, -1)
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;

    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
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
      
      constructor(private userId: string) {
        super();
      }

      async _getRelevantDocuments(query: string) {
        return await searchPineconeViaAPI(query, this.userId);
      }
    }

    const retriever = new CustomPineconeRetriever(userId);

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
