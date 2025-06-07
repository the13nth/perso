// Remove edge runtime for now since we're using Node.js features
// export const runtime = 'edge';

import { NextResponse, NextRequest } from "next/server";
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
import { PineconeMetadata, ContentType } from '@/app/lib/content/types';
import { SwarmRetrievalService } from '@/app/lib/services/SwarmRetrievalService';

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

  // Extract type-specific metadata if available
  let typeMetadata: any = {};
  if (meta.contentType === 'document' && meta.document) {
    try {
      typeMetadata = JSON.parse(meta.document);
    } catch (e) {}
  } else if (meta.contentType === 'note' && meta.note) {
    try {
      typeMetadata = JSON.parse(meta.note);
    } catch (e) {}
  } else if (meta.contentType === 'activity' && meta.activity) {
    try {
      typeMetadata = JSON.parse(meta.activity);
    } catch (e) {}
  } else if (meta.contentType === 'swarm_result' && meta.swarm) {
    try {
      typeMetadata = JSON.parse(meta.swarm);
    } catch (e) {}
  }

  // Format based on content type
  switch (meta.contentType) {
    case 'document':
      formattedContent = `📄 DOCUMENT [${meta.title || 'Untitled'}]\n${doc.pageContent}`;
      if (typeMetadata.complexity) {
        formattedContent += `\nComplexity: ${typeMetadata.complexity}`;
      }
      break;
      
    case 'note':
      formattedContent = `📝 NOTE [${meta.title || 'Untitled'}]${typeMetadata.isPinned ? ' 📌' : ''}${typeMetadata.isStarred ? ' ⭐' : ''}\n${doc.pageContent}`;
      if (typeMetadata.context) {
        formattedContent += `\nContext: ${typeMetadata.context}`;
      }
      break;
      
    case 'activity':
      formattedContent = `🏃 ACTIVITY [${typeMetadata.activityType || 'Unknown Type'}]\n${doc.pageContent}`;
      if (typeMetadata.duration) {
        formattedContent += `\nDuration: ${typeMetadata.duration}`;
      }
      if (typeMetadata.location) {
        formattedContent += `\nLocation: ${typeMetadata.location}`;
      }
      break;
      
    case 'swarm_result':
      formattedContent = `🤖 AI RESULT [${typeMetadata.resultType || 'Unknown Type'}]\n${doc.pageContent}`;
      if (typeMetadata.confidence) {
        formattedContent += `\nConfidence: ${(typeMetadata.confidence * 100).toFixed(1)}%`;
      }
      break;
      
    default:
      formattedContent = doc.pageContent;
  }

  // Add metadata
  formattedContent += '\n---';
  if (meta.primaryCategory) {
    formattedContent += `\nCategory: ${meta.primaryCategory}`;
  }
  if (meta.createdAt) {
    formattedContent += `\nCreated: ${new Date(meta.createdAt).toLocaleString()}`;
  }
  if (meta.score) {
    formattedContent += `\nRelevance: ${(meta.score * 100).toFixed(1)}%`;
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
    // Filter for user's own content and active status
    const filter = {
      userId: userId,
      status: 'active'
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
      const metadata = match.metadata as PineconeMetadata;
      
      // Convert string arrays back to arrays
      const secondaryCategories = metadata.secondaryCategories ? metadata.secondaryCategories.split(',').filter(Boolean) : [];
      const tags = metadata.tags ? metadata.tags.split(',').filter(Boolean) : [];
      const keywords = metadata.keywords ? metadata.keywords.split(',').filter(Boolean) : [];
      const relatedIds = metadata.relatedIds ? metadata.relatedIds.split(',').filter(Boolean) : [];
      const references = metadata.references ? metadata.references.split(',').filter(Boolean) : [];
      const sharedWith = metadata.sharedWith ? metadata.sharedWith.split(',').filter(Boolean) : [];

      return new Document({
        pageContent: metadata.text || "",
        metadata: {
          // Core Metadata
          contentType: metadata.contentType as ContentType,
          contentId: metadata.contentId,
          userId: metadata.userId,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          version: metadata.version,
          status: metadata.status,

          // Chunking Information
          chunkIndex: parseInt(metadata.chunkIndex),
          totalChunks: parseInt(metadata.totalChunks),
          isFirstChunk: metadata.isFirstChunk === 'true',

          // Access Control
          access: metadata.access as 'public' | 'personal' | 'shared',
          sharedWith,

          // Classification & Organization
          primaryCategory: metadata.primaryCategory,
          secondaryCategories,
          tags,

          // Content Fields
          title: metadata.title,
          text: metadata.text,
          summary: metadata.summary,

          // Search Optimization
          searchableText: metadata.searchableText,
          keywords,
          language: metadata.language,

          // Relationships
          relatedIds,
          references,

          // Type-specific metadata (as JSON strings)
          document: metadata.document,
          note: metadata.note,
          activity: metadata.activity,
          swarm: metadata.swarm,

          // Search score
          score: match.score
        }
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

const retrievalService = new SwarmRetrievalService();

export async function POST(req: NextRequest) {
  try {
    // Get user session
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { messages, contextType } = await req.json();
    
    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process the retrieval request using swarm
    const result = await retrievalService.processRetrievalRequest(
      lastUserMessage.content,
      userId,
      contextType
    );

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error in retrieval route:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
