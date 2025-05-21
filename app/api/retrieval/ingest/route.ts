import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

// Remove edge runtime since we need Node.js features
// export const runtime = "edge";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error("Missing PINECONE_ENVIRONMENT environment variable");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into Pinecone using Gemini embeddings for retrieval.
 */
export async function POST(req: NextRequest) {
  try {
    console.log("Starting document ingestion process...");

    // Check authentication first
    console.log("Checking authentication...");
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the input text from the request
    const { text } = await req.json();
    if (!text) {
      return new NextResponse("Missing text in request body", { status: 400 });
    }

    // Initialize text splitter
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    // Split text into chunks
    console.log("Splitting text into chunks...");
    const chunks = await splitter.splitText(text);

    // Initialize embeddings model with dimension matching Pinecone index
    console.log("Initializing embeddings model...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001"
    });

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Generate embeddings and upsert to Pinecone
    console.log("Generating embeddings and upserting to Pinecone...");
    const vectors = await Promise.all(
      chunks.map(async (chunk: string, i: number) => {
        const embedding = await embeddings.embedQuery(chunk);
        return {
          id: `${userId}-${Date.now()}-${i}`,
          values: embedding,
          metadata: {
            text: chunk,
            userId,
          },
        };
      })
    );

    // Upsert vectors in batches
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }

    console.log("Successfully ingested document");
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in document ingestion:", error);
    return new NextResponse(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
