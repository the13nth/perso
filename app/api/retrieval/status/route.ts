import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * This handler checks the status of a document being processed asynchronously
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the document ID from the URL
    const url = new URL(req.url);
    const documentId = url.searchParams.get("documentId");
    
    if (!documentId) {
      return new NextResponse(JSON.stringify({ 
        error: "Missing documentId parameter"
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if the document exists in Pinecone
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Look for any chunks with this document ID (only for the current user)
    const queryResponse = await index.query({
      vector: Array(1536).fill(0), // Dummy vector for metadata filtering
      topK: 1,
      filter: {
        documentId: documentId,
        userId: userId // Security: only query user's own documents
      },
      includeMetadata: true
    });

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      // Document exists, get the first chunk to check metadata
      const firstChunk = queryResponse.matches[0];
      const metadata = firstChunk.metadata;
      
      if (!metadata) {
        return new NextResponse(JSON.stringify({
          status: "unknown",
          message: "Document exists but metadata is missing"
        }), { 
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Check if processing is complete
      // Ensure totalChunks is a number
      const totalChunks = typeof metadata.totalChunks === 'number' 
        ? metadata.totalChunks 
        : typeof metadata.totalChunks === 'string'
          ? parseInt(metadata.totalChunks, 10)
          : 0;
      
      // Query to count how many chunks have been processed (only user's own)
      const countResponse = await index.query({
        vector: Array(1536).fill(0),
        topK: totalChunks > 0 ? totalChunks : 100, // Use totalChunks if valid, otherwise default to 100
        filter: {
          documentId: documentId,
          userId: userId // Security: only count user's own document chunks
        },
        includeMetadata: false
      });
      
      const processedChunks = countResponse.matches ? countResponse.matches.length : 0;
      const isComplete = processedChunks >= totalChunks && totalChunks > 0;
      
      // Get categories as string array
      let categories: string[] = ["general"];
      if (Array.isArray(metadata.categories)) {
        categories = metadata.categories as string[];
      } else if (typeof metadata.categories === 'string') {
        categories = [metadata.categories];
      }
      
      // Calculate progress percentage
      const progress = totalChunks > 0 
        ? Math.round((processedChunks / totalChunks) * 100) 
        : 0;
      
      return new NextResponse(JSON.stringify({
        status: isComplete ? "complete" : "processing",
        progress,
        processedChunks,
        totalChunks,
        title: metadata.title as string || "Untitled Document",
        categories,
        access: metadata.access as string || "personal"
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      // No document found with this ID
      return new NextResponse(JSON.stringify({
        status: "not_found",
        message: "Document not found or processing hasn't started"
      }), { 
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Error checking document status:", error);
    return new NextResponse(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 