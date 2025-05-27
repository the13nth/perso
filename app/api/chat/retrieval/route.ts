import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Message as VercelChatMessage } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";
import { auth } from "@clerk/nextjs/server";

// Define types
type PineconeMatch = {
  id: string;
  score?: number;
  metadata: Record<string, any>;
  values?: number[];
};

type PineconeMetadata = {
  contentType: string;
  title: string;
  similarity: number;
  owner: string;
};

type DocumentMetadata = {
  text?: string;
  userId: string;
  type?: string;
  sessionId?: string;
  title?: string;
  query?: string;
  response?: string;
  activity?: string;
  category?: string;
  activityDate?: string;
  duration?: string;
  similarity?: number;
};

type ChainInput = {
  question: string;
  chat_history: string | string[];
};

const condenseQuestionPrompt = PromptTemplate.fromTemplate(`Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}

Follow Up Input: {question}
Standalone question:`);

const answerPrompt = PromptTemplate.fromTemplate(`You are a helpful AI assistant. Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know. DO NOT try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.

Context:
{context}

Question: {question}
Helpful answer:`);

function formatDocument(doc: Document) {
  const metadata = doc.metadata as DocumentMetadata;
  let formattedText = "";

  // Extract the actual content
  const content = doc.pageContent || metadata.text || "";

  if (metadata.type === "conversation") {
    formattedText = `Previous conversation: "${metadata.title}"\nQ: ${metadata.query}\nA: ${metadata.response}`;
  } else if (metadata.type === "comprehensive_activity") {
    formattedText = `Activity: ${metadata.activity} (${metadata.category})\nDate: ${metadata.activityDate}\nDuration: ${metadata.duration}\nDetails: ${content}`;
  } else if (metadata.type === "note") {
    formattedText = `Note: ${metadata.title}\n${content}`;
  } else {
    formattedText = content;
  }

  return formattedText;
}

async function searchPinecone(
  pineconeIndex: any,
  embeddings: GoogleGenerativeAIEmbeddings,
  query: string,
  userId: string,
  topK = 10
) {
  try {
    const queryEmbedding = await embeddings.embedQuery(query);

    // Try search with userId filter first
    const results = await pineconeIndex.query({
      vector: queryEmbedding,
      topK: 20,
      includeMetadata: true,
      filter: { userId }
    });

    // Sort by relevance and take top K
    const relevantResults = results.matches
      .filter((match: PineconeMatch) => match.score && match.score > 0.6)
      .sort((a: PineconeMatch, b: PineconeMatch) => (b.score || 0) - (a.score || 0))
      .slice(0, topK);

    return relevantResults.map((match: PineconeMatch) => {
      const metadata = match.metadata as DocumentMetadata;
      return new Document({
        pageContent: metadata.text || match.metadata?.content || "",
        metadata: {
          ...metadata,
          similarity: match.score || 0
        },
      });
    });
  } catch (error) {
    console.error("Error searching Pinecone:", error);
    return [];
  }
}

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

    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "");

    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retriever = {
      invoke: async (query: string) => {
        const documents = await searchPinecone(pineconeIndex, embeddings, query, userId);
        resolveWithDocuments(documents);
        return documents;
      },
    };

    const chain = RunnableSequence.from([
      {
        standalone_question: async (input: ChainInput) => {
          const standaloneQuestionChain = condenseQuestionPrompt
            .pipe(model)
            .pipe(new StringOutputParser());
          return standaloneQuestionChain.invoke({
            chat_history: Array.isArray(input.chat_history) ? input.chat_history.join("\n") : input.chat_history,
            question: input.question,
          });
        },
        original_input: (input: ChainInput) => input.question,
      },
      async (input: any) => {
        const relevantDocs = await retriever.invoke(input.standalone_question);
        const context = relevantDocs
          .map((doc: Document<DocumentMetadata>) => formatDocument(doc))
          .join("\n\n");
        
        return {
          context: context || "No relevant context found in the knowledge base.",
          question: input.original_input,
        };
      },
      answerPrompt,
      model,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream({
      chat_history: previousMessages.map((m: VercelChatMessage) => `${m.role}: ${m.content}`).join("\n"),
      question: currentMessageContent,
    });

    const documents = await documentPromise;
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc: { pageContent: string; metadata: Record<string, any> }) => {
          const metadata = doc.metadata as DocumentMetadata;
          return {
            pageContent: doc.pageContent.slice(0, 100),
            metadata: {
              contentType: metadata.type || "document",
              title: metadata.title || "Untitled",
              similarity: metadata.similarity || 0,
              owner: metadata.userId === userId ? "You" : "Other"
            } as PineconeMetadata,
          };
        })
      )
    ).toString("base64");

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'x-message-index': (previousMessages.length + 1).toString(),
        'x-sources': serializedSources,
      },
    });
  } catch (error: Error | unknown) {
    console.error("Error in chat/retrieval:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
