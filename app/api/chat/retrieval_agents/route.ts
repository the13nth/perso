// Remove edge runtime for now since we're using Node.js features
// export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage } from "ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
import { formatDocumentsAsString } from "langchain/util/document";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { auth } from "@clerk/nextjs/server";

interface PineconeMatch {
  metadata: {
    text?: string;
    documentId?: string;
    title?: string;
    chunkIndex?: number;
    totalChunks?: number;
    categories?: string[];
    access?: string;
    createdAt?: string;
    userId?: string;
  };
  score?: number;
}

const QUERY_CLARIFICATION_TEMPLATE = `You are a query understanding assistant. Your job is to analyze user queries and make them more explicit and searchable for a document retrieval system.

Given the user's query and chat history, create a clear, standalone search query that captures what the user is really looking for.

Guidelines:
1. Make implicit references explicit (e.g., "that document" → "the document about X mentioned earlier")
2. Add relevant context from chat history if needed
3. Expand abbreviations and unclear terms
4. If the query is already clear and specific, return it as-is
5. Focus on what the user wants to find, not how they want it presented
6. Keep it concise but comprehensive
7. If the user is asking for analysis or comparison, clarify what they want analyzed

Chat History:
{chat_history}

Original Query: {original_query}

Clarified Query:`;

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new SystemMessage(message.content);
  }
};

async function clarifyQuery(
  chatModel: ChatGoogleGenerativeAI,
  originalQuery: string,
  chatHistory: BaseMessage[]
): Promise<string> {
  console.log('🧠 Clarifying query:', originalQuery);
  
  try {
    const queryClarificationPrompt = PromptTemplate.fromTemplate(QUERY_CLARIFICATION_TEMPLATE);
    
    const clarificationChain = RunnableSequence.from([
      queryClarificationPrompt,
      chatModel,
      new StringOutputParser(),
    ]);

    const chatHistoryText = chatHistory.map(msg => {
      if (msg instanceof HumanMessage) return `user: ${msg.content}`;
      if (msg instanceof AIMessage) return `assistant: ${msg.content}`;
      return `${msg._getType()}: ${msg.content}`;
    }).join('\n');

    const clarifiedQuery = await clarificationChain.invoke({
      original_query: originalQuery,
      chat_history: chatHistoryText
    });

    const cleanedQuery = clarifiedQuery.trim();
    console.log('✨ Clarified query:', cleanedQuery);
    
    // If the clarified query is too similar to original or seems like it didn't improve, use original
    if (cleanedQuery.toLowerCase() === originalQuery.toLowerCase() || 
        cleanedQuery.length < originalQuery.length * 0.8) {
      console.log('📝 Using original query as clarification didn\'t improve it significantly');
      return originalQuery;
    }
    
    return cleanedQuery;
  } catch (_error) {
    console.error('❌ Query clarification failed, using original:', _error);
    return originalQuery;
  }
}

// Custom Pinecone retriever using fetch API instead of Node.js SDK
async function searchPineconeViaAPI(query: string, userId: string, topK = 5) {
  // Get embedding for the query
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY || "",
    modelName: "embedding-001",
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
  return data.matches.map((match: unknown) => {
    const typedMatch = match as PineconeMatch;
    const metadata = typedMatch.metadata || {};
    
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
        score: typedMatch.score,
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

    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash-001",
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    // Create a separate model instance for query clarification with lower temperature
    const clarificationModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash-001",
      maxOutputTokens: 512,
      temperature: 0.3,
    });

    // Enhanced Pinecone retriever with query clarification
    class CustomPineconeRetriever extends BaseRetriever {
      lc_namespace = ["langchain", "retrievers", "pinecone"];
      
      constructor(
        private userId: string,
        private chatModel: ChatGoogleGenerativeAI,
        private chatHistory: BaseMessage[]
      ) {
        super();
      }

      async _getRelevantDocuments(query: string) {
        console.log('🔍 Original Query:', query);
        
        // Step 1: Clarify the query using LLM
        const clarifiedQuery = await clarifyQuery(this.chatModel, query, this.chatHistory);
        
        // Step 2: Search using the clarified query
        const documents = await searchPineconeViaAPI(clarifiedQuery, this.userId);
        console.log('📄 Retrieved Documents:', documents.length);
        
        // If clarified query returns no results, try with original query as fallback
        if (documents.length === 0 && clarifiedQuery !== query) {
          console.log('🔄 No results with clarified query, trying original query as fallback');
          const fallbackDocuments = await searchPineconeViaAPI(query, this.userId);
          console.log('📄 Fallback Retrieved Documents:', fallbackDocuments.length);
          return fallbackDocuments;
        }
        
        return documents;
      }
    }

    const retriever = new CustomPineconeRetriever(userId, clarificationModel, formattedPreviousMessages);

    const prompt = PromptTemplate.fromTemplate(`
      You are a helpful AI assistant that answers questions based on the provided context. If you 
      don't know something or it's not mentioned in the context, just say so.
      
      Context: {context}
      
      Question: {question}
      
      Answer:
    `);

    const chain = RunnableSequence.from([
      {
        question: (input: { question: string; chat_history: BaseMessage[] }) => input.question,
      },
      {
        context: async (input: { question: string }) => {
          const relevantDocs = await retriever.getRelevantDocuments(
            input.question,
          );
          return formatDocumentsAsString(relevantDocs);
        },
        question: (input) => input.question,
      },
      {
        result: async (input) => {
          const result = await prompt.pipe(chatModel).invoke({
            context: input.context,
            question: input.question,
          });
          return result;
        },
      },
    ]);

    const stream = await chain.stream({
      question: messages[messages.length - 1].content,
      chat_history: formattedPreviousMessages,
    });

    return new Response(stream);
  } catch (error: unknown) {
    console.error("Error in retrieval agents:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
