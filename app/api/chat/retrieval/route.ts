import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Message as VercelChatMessage } from "ai";
import { StreamingTextResponse } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { Pinecone, type Index, type ScoredPineconeRecord, type RecordMetadata } from "@pinecone-database/pinecone";
import { auth } from "@clerk/nextjs/server";

interface PineconeMatch {
  id: string;
  score: number;
  values: number[];
  metadata: { [key: string]: unknown };
}

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You are Ubumuntu AI, a personal AI assistant that helps with activity tracking, document management, and general assistance. You have access to the user's personal documents, notes, and activity logs. Answer questions based on the provided context and chat history.

If you're asked about activities, be specific about dates, types, and metrics. If you're asked about documents or notes, reference them appropriately. Always be helpful and detailed in your responses.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Answer:`;

const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

async function searchPinecone(
  pineconeIndex: Index,
  embeddings: GoogleGenerativeAIEmbeddings,
  query: string,
  userId: string,
  topK = 10
) {
  // Get the embedding for the query
  const queryEmbedding = await embeddings.embedQuery(query);

  // Search for similar documents in Pinecone with user filtering
  const results = await pineconeIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter: {
      // Only user's own content - no access to other users' content
      userId: userId
    }
  });

  // Convert the matches to Document objects
  return results.matches.map((match: ScoredPineconeRecord<RecordMetadata>) => {
    const metadata = match.metadata ?? {};
    
    // Extract text content
    let text = "";
    if (typeof (metadata as { text?: unknown }).text === "string") {
      text = (metadata as { text?: unknown }).text as string;
    }
    
    // Create enhanced metadata for different content types
    let enhancedMetadata: any = {
      ...metadata,
      similarity: match.score ?? 0,
      owner: metadata.userId === userId ? "You" : "Other user"
    };
    
    // Special handling for activities
    if (metadata.type === "comprehensive_activity") {
      const activityMeta = metadata as any;
      enhancedMetadata = {
        ...enhancedMetadata,
        contentType: "Activity",
        activityType: activityMeta.activity || "Unknown",
        category: activityMeta.category || "Unknown",
        date: activityMeta.activityDate || "Unknown date",
        duration: activityMeta.duration || "Unknown duration",
        title: activityMeta.title || "Activity"
      };
    } else if (metadata.type === "note") {
      enhancedMetadata = {
        ...enhancedMetadata,
        contentType: "Note",
        title: metadata.title || "Note"
      };
    } else {
      enhancedMetadata = {
        ...enhancedMetadata,
        contentType: "Document",
        title: metadata.title || "Document"
      };
    }
    
    return new Document({
      pageContent: text,
      metadata: enhancedMetadata
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    // Get user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to use this feature" },
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
      modelName: "text-embedding-004", // Use the same model as activities
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

    const retrievalChain = async (query: string) => {
      const docs = await retriever.invoke(query);
      return docs.map((doc: Document) => {
        const meta = doc.metadata;
        let contextLine = doc.pageContent;
        
        // Add context information for different content types
        if (meta.contentType === "Activity") {
          contextLine = `[ACTIVITY - ${meta.category}/${meta.activityType} on ${meta.date}]\n${contextLine}`;
        } else if (meta.contentType === "Note") {
          contextLine = `[NOTE - ${meta.title}]\n${contextLine}`;
        } else if (meta.contentType === "Document") {
          contextLine = `[DOCUMENT - ${meta.title}]\n${contextLine}`;
        }
        
        return contextLine;
      }).join('\n\n---\n\n');
    };

    const answerChain = RunnableSequence.from([
      {
        context: RunnableSequence.from([
          (input) => input.question,
          retrievalChain,
        ]),
        chat_history: (input) => input.chat_history,
        question: (input) => input.question,
      },
      answerPrompt,
      model,
      new BytesOutputParser(),
    ]);

    const stream = await answerChain.stream({
      question: currentMessageContent,
      chat_history: formatMessages(previousMessages),
    });

    const documents = await documentPromise;
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc) => ({
          pageContent: `${doc.pageContent.slice(0, 100)}...`,
          metadata: {
            contentType: doc.metadata.contentType,
            title: doc.metadata.title,
            similarity: doc.metadata.similarity,
            owner: doc.metadata.owner
          },
        })),
      ),
    ).toString("base64");

    return new StreamingTextResponse(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: unknown) {
    console.error("Error during retrieval:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unknown error",
        details: e instanceof Error ? e.stack : undefined
      },
      {
        status:
          typeof e === "object" &&
          e !== null &&
          "status" in e &&
          typeof (e as { status?: unknown }).status === "number"
            ? (e as { status: number }).status
            : 500
      }
    );
  }
}

function formatMessages(messages: VercelChatMessage[]) {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}
