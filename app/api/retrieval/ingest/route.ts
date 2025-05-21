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
    
    // Add rate limiting to avoid hitting API limits
    const vectors = [];
    const chunkBatchSize = 50; // Process in smaller batches
    
    for (let i = 0; i < chunks.length; i += chunkBatchSize) {
      console.log(`Processing batch ${Math.floor(i/chunkBatchSize) + 1} of ${Math.ceil(chunks.length/chunkBatchSize)}`);
      const batchChunks = chunks.slice(i, i + chunkBatchSize);
      
      // Process each chunk with some delay between each one
      for (let j = 0; j < batchChunks.length; j++) {
        try {
          const embedding = await embeddings.embedQuery(batchChunks[j]);
          vectors.push({
            id: `${userId}-${Date.now()}-${i+j}`,
            values: embedding,
            metadata: {
              text: batchChunks[j],
              userId,
            },
          });
          
          // Add a small delay between each API call
          if (j < batchChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
          }
        } catch (error) {
          console.error("Error generating embedding, retrying with backoff:", error);
          // Simple exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay on error
          j--; // Retry this item
        }
      }
      
      // Add a delay between batches
      if (i + chunkBatchSize < chunks.length) {
        console.log("Pausing between batches to avoid rate limits...");
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s pause between batches
      }
    }

    // Upsert vectors in batches
    const upsertBatchSize = 100;
    for (let i = 0; i < vectors.length; i += upsertBatchSize) {
      const batch = vectors.slice(i, i + upsertBatchSize);
      await index.upsert(batch);
      
      // Add a small delay between Pinecone batches if needed
      if (i + upsertBatchSize < vectors.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
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
