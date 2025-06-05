// Remove edge runtime for now since we're using Node.js features
// export const runtime = 'edge';

import { NextResponse } from "next/server";
import { Message as VercelChatMessage } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone, Index, ScoredPineconeRecord, RecordMetadata } from "@pinecone-database/pinecone";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { auth } from "@clerk/nextjs/server";

const TEMPLATE = `You are Ubumuntu AI, a personal AI assistant. You have access to a knowledge base of documents and information.

Instructions:
1. Use the provided context to enhance your response when relevant
2. If the context doesn't contain relevant information, use your general knowledge
3. Format your response in markdown with clear sections and bullet points when appropriate

Context from knowledge base:
{context}

Chat History:
{history}

User's query: {query}`;

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

const prompt = PromptTemplate.fromTemplate(TEMPLATE);
const queryClarificationPrompt = PromptTemplate.fromTemplate(QUERY_CLARIFICATION_TEMPLATE);

function formatDocument(doc: Document) {
  const meta = doc.metadata;
  let formattedContent = "";

  if (meta.type === "note") {
    formattedContent = `NOTE [${meta.title || 'Untitled'}]:\n${doc.pageContent}`;
  } else if (meta.type === "activity") {
    formattedContent = `ACTIVITY LOG [${meta.category || 'Uncategorized'}]:\n${doc.pageContent}`;
  } else if (meta.type === "document") {
    formattedContent = `DOCUMENT [${meta.title || 'Untitled'}]:\n${doc.pageContent}`;
  } else {
    formattedContent = doc.pageContent;
  }

  if (meta.score) {
    formattedContent += `\nRelevance: ${(meta.score * 100).toFixed(2)}%`;
  }

  return formattedContent;
}

async function clarifyQuery(
  model: ChatGoogleGenerativeAI,
  originalQuery: string,
  chatHistory: string
): Promise<string> {
  console.log('🧠 Clarifying query:', originalQuery);
  
  try {
    const clarificationChain = RunnableSequence.from([
      queryClarificationPrompt,
      model,
      new StringOutputParser(),
    ]);

    const clarifiedQuery = await clarificationChain.invoke({
      original_query: originalQuery,
      chat_history: chatHistory
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
  } catch (error) {
    console.error('❌ Query clarification failed, using original:', error);
    return originalQuery;
  }
}

async function searchPinecone(
  pineconeIndex: Index<RecordMetadata>,
  embeddings: GoogleGenerativeAIEmbeddings,
  query: string,
  userId: string
): Promise<Document[]> {
  const queryEmbedding = await embeddings.embedQuery(query);
  console.log('🔍 Searching for:', query);

  try {
    const filter = {
      userId: userId
    };

    const results = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 20,
      includeMetadata: true,
      filter
    });

    if (!results.matches?.length) {
      console.log('⚠️ No matches found at all');
      return [];
    }

    const relevantMatches = results.matches.filter((match: ScoredPineconeRecord<RecordMetadata>) => (match.score || 0) > 0.5);
    console.log(`📊 Found ${relevantMatches.length} relevant matches above 0.5 threshold`);

    return relevantMatches.map((match: ScoredPineconeRecord<RecordMetadata>) => {
      return new Document({
        pageContent: match.metadata?.text as string || "",
        metadata: { ...match.metadata, score: match.score }
      });
    });
  } catch (error) {
    console.error('❌ Search error:', error);
    throw error;
  }
}

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { messages } = body;

    const model = await initializeGeminiModel({
      maxOutputTokens: 2048,
      temperature: 0.7,
    });

    // Create a separate model instance for query clarification with lower temperature for more consistent results
    const clarificationModel = await initializeGeminiModel({
      maxOutputTokens: 512,
      temperature: 0.3,
    });

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001",
    });

    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "");

    // Enhanced retriever with query clarification
    const retrieverRunnable = new RunnableLambda({
      func: async (input: { question: string; chat_history: string }) => {
        console.log('🔍 Original Query:', input.question);
        
        // Step 1: Clarify the query using LLM
        const clarifiedQuery = await clarifyQuery(
          clarificationModel, 
          input.question, 
          input.chat_history
        );
        
        // Step 2: Search using the clarified query
        const documents = await searchPinecone(pineconeIndex, embeddings, clarifiedQuery, userId);
        console.log('📄 Retrieved Documents:', documents.length);
        
        // If clarified query returns no results, try with original query as fallback
        if (documents.length === 0 && clarifiedQuery !== input.question) {
          console.log('🔄 No results with clarified query, trying original query as fallback');
          const fallbackDocuments = await searchPinecone(pineconeIndex, embeddings, input.question, userId);
          console.log('📄 Fallback Retrieved Documents:', fallbackDocuments.length);
          return fallbackDocuments;
        }
        
        return documents;
      }
    });

    const contextChain = RunnableSequence.from([
      (input: { question: string; chat_history: string }) => input,
      retrieverRunnable,
      (docs: Document[]) => {
        if (!Array.isArray(docs)) {
          console.error("Docs is not an array in contextChain:", docs);
          return "Error: Could not retrieve context properly.";
        }
        return docs.map((doc) => formatDocument(doc)).join("\n\n");
      }
    ]);

    const chain = RunnableSequence.from([
      {
        context: contextChain,
        history: (input: { question: string; chat_history: string }) => input.chat_history,
        query: (input: { question: string; chat_history: string }) => input.question,
      },
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const response = await chain.invoke({
      question: messages[messages.length - 1].content,
      chat_history: messages.slice(0, -1).map(formatMessage).join('\n'),
    });

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
