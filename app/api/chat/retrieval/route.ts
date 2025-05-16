import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";

const CONDENSE_QUESTION_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);

const ANSWER_TEMPLATE = `You are an AI assistant for African business growth. Answer the question based only on the following context and chat history.
If you don't know the answer, just say you don't know. DO NOT try to make up an answer.

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
Answer:`;

const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);

async function searchPinecone(pineconeIndex: any, embeddings: GoogleGenerativeAIEmbeddings, query: string, topK: number = 5) {
  // Get the embedding for the query
  const queryEmbedding = await embeddings.embedQuery(query);

  // Search for similar documents in Pinecone
  const results = await pineconeIndex.query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true
  });

  // Convert the matches to Document objects
  return results.matches.map((match: any) => new Document({
    pageContent: match.metadata.text,
    metadata: {
      ...match.metadata,
      similarity: match.score
    }
  }));
}

export async function POST(req: NextRequest) {
  try {
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
      modelName: "embedding-001",
    });

    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX || "");

    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    const retriever = {
      invoke: async (query: string) => {
        const documents = await searchPinecone(pineconeIndex, embeddings, query);
        resolveWithDocuments(documents);
        return documents;
      },
    };

    const retrievalChain = async (query: string) => {
      const docs = await retriever.invoke(query);
      return docs.map((doc: Document) => doc.pageContent).join('\n\n');
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
          pageContent: doc.pageContent.slice(0, 50) + "...",
          metadata: doc.metadata,
        })),
      ),
    ).toString("base64");

    return new StreamingTextResponse(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: any) {
    console.error("Error during retrieval:", e);
    return NextResponse.json(
      { error: e.message, details: e.stack },
      { status: e.status ?? 500 }
    );
  }
}

function formatMessages(messages: VercelChatMessage[]) {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}
