import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Message as VercelChatMessage, LangChainAdapter } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import {
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { Pinecone, type Index, type RecordMetadata } from "@pinecone-database/pinecone";
import { auth } from "@clerk/nextjs/server";

// Define proper types for metadata
type DocumentMetadata = Partial<{
  text: string;
  userId: string;
  type: string;
  sessionId: string;
  title: string;
  query: string;
  response: string;
  activity: string;
  category: string;
  activityDate: string;
  duration: string;
  score: number;
}> & RecordMetadata;

// Add type definition at the top with other types
type PineconeFilter = {
  userId: string;
  [key: string]: string | number | boolean;
};

const ANSWER_TEMPLATE = `You are Ubumuntu AI, a personal AI assistant. You have access to a knowledge base of documents and information.

Instructions:
1. Use ONLY the provided context to answer the question
2. If the context doesn't contain relevant information, say "I don't have any information about that in my knowledge base"
3. Do not make up or infer information not present in the context
4. If the context is irrelevant to the question, ignore it and say you don't have relevant information

Context from knowledge base:
{context}

Chat History:
{chat_history}

Current Question: {question}
Assistant: Let me check the provided context and answer your question.`;

function formatDocument(doc: Document) {
  const meta = doc.metadata;
  let formattedContent = "";

  // Format based on document type
  if (meta.type === "note") {
    formattedContent = `NOTE [${meta.title || 'Untitled'}]:\n${doc.pageContent}`;
  } else if (meta.type === "activity") {
    formattedContent = `ACTIVITY LOG [${meta.category || 'Uncategorized'}]:\n${doc.pageContent}`;
  } else if (meta.type === "document") {
    formattedContent = `DOCUMENT [${meta.title || 'Untitled'}]:\n${doc.pageContent}`;
  } else {
    formattedContent = doc.pageContent;
  }

  // Add relevance score if available
  if (meta.score) {
    formattedContent += `\nRelevance: ${(meta.score * 100).toFixed(2)}%`;
  }

  return formattedContent;
}

async function searchPinecone(
  pineconeIndex: Index,
  embeddings: GoogleGenerativeAIEmbeddings,
  query: string,
  userId: string
) {
  const queryEmbedding = await embeddings.embedQuery(query);
  console.log('🔍 Searching for:', query);

  try {
    // Simple filter - just use userId
    const filter: PineconeFilter = {
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

    // Debug log all matches
    results.matches.forEach((match, idx) => {
      console.log(`Match ${idx + 1} (score: ${match.score}):`, {
        metadata: match.metadata,
        score: match.score
      });
    });

    // Less strict relevance filtering (0.5 instead of 0.7)
    const relevantMatches = results.matches.filter(match => (match.score || 0) > 0.5);
    console.log(`📊 Found ${relevantMatches.length} relevant matches above 0.5 threshold`);

    return relevantMatches.map(match => {
      const metadata = match.metadata as DocumentMetadata;
      return new Document({
        pageContent: metadata.text || "",
        metadata: {
          ...metadata,
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

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const messages = body.messages ?? [];
    const previousMessages = messages.slice(0, -1);
    const currentMessageContent = messages[messages.length - 1].content;

    const model = await initializeGeminiModel({
      maxOutputTokens: 2048,
      temperature: 0.2,
    });

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "text-embedding-004",
    });

    console.log('🌲 Initializing Pinecone index...');
    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "");
    console.log('✅ Pinecone index initialized:', process.env.PINECONE_INDEX);

    const retriever = {
      invoke: async (query: string) => {
        console.log('🔍 Retriever Query:', query);
        const documents = await searchPinecone(pineconeIndex, embeddings, query, userId);
        console.log('📄 Retrieved Documents:', documents.length);
        console.log('📝 First Document Sample:', documents[0]?.pageContent.slice(0, 100));
        return documents;
      },
    };

    const prompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

    const chain = RunnableSequence.from([
      {
        context: async (input: { question: string; chat_history: string }) => {
          console.log('🔍 Original Question:', input.question);
          const docs = await retriever.invoke(input.question);
          const formattedDocs = docs.map((doc: Document) => formatDocument(doc)).join('\n\n');
          console.log('📚 Context Sample:', formattedDocs.slice(0, 200));
          return formattedDocs;
        },
        chat_history: (input: { chat_history: string }) => {
          console.log('💬 Chat History Length:', input.chat_history.length);
          return input.chat_history;
        },
        question: (input: { question: string }) => {
          console.log('❓ Final Question:', input.question);
          return input.question;
        },
      },
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream({
      question: currentMessageContent,
      chat_history: previousMessages.map(formatMessage).join('\n'),
    });

    return LangChainAdapter.toDataStreamResponse(stream);
  } catch (error: Error | unknown) {
    console.error("Error in chat/retrieval:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
