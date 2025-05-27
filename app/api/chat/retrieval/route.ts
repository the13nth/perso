import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Message as VercelChatMessage } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import {
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { HttpResponseOutputParser } from "langchain/output_parsers";
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
}> & RecordMetadata;

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You are Ubumuntu AI, a personal AI assistant that helps with activity tracking, document management, and general assistance. You have access to the user's personal documents, notes, activity logs, and previous conversations.

When answering questions:
- Reference previous conversations when relevant using the format: "As we discussed before..." or "Building on our previous conversation..."
- For activities, be specific about dates, types, and metrics
- For documents or notes, reference them appropriately
- For previous conversations, acknowledge the context and build upon it
- Always be helpful, detailed, and maintain conversation continuity

The context below includes various types of information:
- [PREVIOUS CONVERSATION] - Past discussions from this or other sessions
- [ACTIVITY] - Physical activities, work tasks, or personal logs
- [NOTE] - Personal notes and thoughts
- [DOCUMENT] - Uploaded documents and files

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
  sessionId?: string,
  topK = 10
) {
  const queryEmbedding = await embeddings.embedQuery(query);

  const filter: Record<string, string> = {
    userId: userId
  };

  if (sessionId) {
    filter.sessionId = sessionId;
  }

  const results = await pineconeIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter
  });

  return results.matches.map((match) => {
    const metadata = match.metadata as DocumentMetadata ?? {};
    
    const text = metadata.text || "";
    
    const enhancedMetadata: Record<string, unknown> = {
      ...metadata,
      similarity: match.score ?? 0,
      owner: metadata.userId === userId ? "You" : "Other user"
    };
    
    if (metadata.type === "conversation") {
      enhancedMetadata.contentType = "Conversation";
      enhancedMetadata.query = metadata.query || "Unknown query";
      enhancedMetadata.response = metadata.response || "Unknown response";
      enhancedMetadata.sessionId = metadata.sessionId || "Unknown session";
      enhancedMetadata.title = metadata.title || "Previous conversation";
    } else if (metadata.type === "comprehensive_activity") {
      enhancedMetadata.contentType = "Activity";
      enhancedMetadata.activityType = metadata.activity || "Unknown";
      enhancedMetadata.category = metadata.category || "Unknown";
      enhancedMetadata.date = metadata.activityDate || "Unknown date";
      enhancedMetadata.duration = metadata.duration || "Unknown duration";
      enhancedMetadata.title = metadata.title || "Activity";
    } else if (metadata.type === "note") {
      enhancedMetadata.contentType = "Note";
      enhancedMetadata.title = metadata.title || "Note";
    } else {
      enhancedMetadata.contentType = "Document";
      enhancedMetadata.title = metadata.title || "Document";
    }
    
    return new Document({
      pageContent: text,
      metadata: enhancedMetadata
    });
  });
}

interface ChainInput {
  question: string;
  chat_history: string | string[];
  standalone_question?: string;
  original_input?: string;
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
    const sessionId = body.sessionId; // Extract sessionId from request
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
        const documents = await searchPinecone(pineconeIndex, embeddings, query, userId, sessionId);
        resolveWithDocuments(documents);
        return documents;
      },
    };

    const retrievalChain = async (query: string): Promise<Document[]> => {
      return await retriever.invoke(query);
    };

    const chain = RunnableSequence.from([
      {
        standalone_question: async (input: unknown) => {
          const { question, chat_history } = input as ChainInput;
          const model = await initializeGeminiModel({
            maxOutputTokens: 2048,
            temperature: 0.2,
          });
          const standaloneQuestionChain = condenseQuestionPrompt
            .pipe(model)
            .pipe(new StringOutputParser());
          return standaloneQuestionChain.invoke({
            chat_history: Array.isArray(chat_history) ? chat_history.join("\n") : chat_history,
            question,
          });
        },
        original_input: (input: unknown) => (input as ChainInput).question,
        chat_history: (input: unknown) => (input as ChainInput).chat_history,
      },
      {
        context: async (input: unknown) => {
          const relevantDocs = await retrievalChain((input as ChainInput).standalone_question || '');
          return relevantDocs
            .map((doc) => formatDocument(doc))
            .join("\n\n");
        },
        chat_history: (input: unknown) => (input as ChainInput).chat_history,
        question: (input: unknown) => (input as ChainInput).original_input,
      },
      answerPrompt,
      model,
      new HttpResponseOutputParser(),
    ]);

    const stream = await chain.stream({
      chat_history: formatMessages(previousMessages),
      question: currentMessageContent,
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

    return new Response(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
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

function formatMessages(messages: VercelChatMessage[]) {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}

function formatDocument(doc: Document) {
  let formattedDoc = doc.pageContent;
  const meta = doc.metadata;
  
  // Add context information for different content types
  if (meta.contentType === "Conversation") {
    formattedDoc = `[PREVIOUS CONVERSATION - Session ${meta.sessionId}]\nQuery: ${meta.query}\nResponse: ${meta.response}`;
  } else if (meta.contentType === "Activity") {
    formattedDoc = `[ACTIVITY - ${meta.category}/${meta.activityType} on ${meta.date}]\n${formattedDoc}`;
  } else if (meta.contentType === "Note") {
    formattedDoc = `[NOTE - ${meta.title}]\n${formattedDoc}`;
  } else if (meta.contentType === "Document") {
    formattedDoc = `[DOCUMENT - ${meta.title}]\n${formattedDoc}`;
  }
  
  return formattedDoc;
}
