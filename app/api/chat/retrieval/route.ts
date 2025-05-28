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

const prompt = PromptTemplate.fromTemplate(TEMPLATE);

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

    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001",
    });

    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "");

    const retrieverRunnable = new RunnableLambda({
      func: async (query: string) => {
        console.log('🔍 Retriever Query:', query);
        const documents = await searchPinecone(pineconeIndex, embeddings, query, userId);
        console.log('📄 Retrieved Documents:', documents.length);
        return documents;
      }
    });

    const contextChain = RunnableSequence.from([
      (input: { question: string; chat_history: string }) => input.question,
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
