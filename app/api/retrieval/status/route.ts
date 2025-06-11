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
    
    try {
      // Look for any chunks with this document ID (only for the current user)
      // Use fetch to get all vectors with the documentId
      const queryResponse = await index.query({
        id: `${documentId}-chunk-0`, // Try to find the first chunk specifically
        topK: 1,
        includeMetadata: true
      });

      // If first chunk doesn't exist, try a broader search
      let searchResponse = queryResponse;
      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        // Fall back to vector-based search with filter
        searchResponse = await index.query({
          vector: Array(768).fill(0), // Dummy vector for metadata filtering
          topK: 1,
          filter: {
            documentId: documentId,
            userId: userId // Security: only query user's own documents
          },
          includeMetadata: true
        });
      }

      if (searchResponse.matches && searchResponse.matches.length > 0) {
        // Document exists, get the first chunk to check metadata
        const firstChunk = searchResponse.matches[0];
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
        
        // Count chunks in batches to avoid Pinecone limits and memory issues
        let processedChunks = 0;
        const batchSize = 100; // Reasonable batch size for counting
        let hasMore = true;
        let lastId = '';
        
        while (hasMore && processedChunks < (totalChunks > 0 ? totalChunks * 2 : 2000)) {
          // Query for a batch of chunks
          const countResponse = await index.query({
            vector: Array(768).fill(0),
            topK: batchSize,
            filter: {
              documentId: documentId,
              userId: userId // Security: only count user's own document chunks
            },
            includeMetadata: false
          });
          
          if (countResponse.matches && countResponse.matches.length > 0) {
            // Filter out any duplicates based on lastId to handle pagination
            const newMatches = lastId 
              ? countResponse.matches.filter(match => match.id > lastId)
              : countResponse.matches;
            
            processedChunks += newMatches.length;
            
            // Check if we got fewer results than requested (indicates end of data)
            if (countResponse.matches.length < batchSize) {
              hasMore = false;
            } else {
              // Update lastId for next iteration
              lastId = countResponse.matches[countResponse.matches.length - 1].id || '';
              
              // If we didn't get any new matches, we've reached the end
              if (newMatches.length === 0) {
                hasMore = false;
              }
            }
          } else {
            hasMore = false;
          }
          
          // Safety break to avoid infinite loops
          if (processedChunks >= 10000) {
            console.warn(`Chunk count exceeded 10000 for document ${documentId}, stopping count`);
            break;
          }
        }
        
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
        // No document found with this ID - check if it might be processing
        // Extract timestamp from documentId to see if it's recent
        const timestampMatch = documentId.match(/-(\d+)$/);
        if (timestampMatch) {
          const timestamp = parseInt(timestampMatch[1]);
          const now = Date.now();
          const timeDiff = now - timestamp;
          
          // If document was created within the last 30 minutes, it might still be processing
          if (timeDiff < 30 * 60 * 1000) { // 30 minutes
            return new NextResponse(JSON.stringify({
              status: "processing",
              progress: 0,
              processedChunks: 0,
              totalChunks: 0,
              message: "Document is being processed. Embeddings are being generated..."
            }), { 
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
        
        // Document not found and not recent
        return new NextResponse(JSON.stringify({
          status: "not_found",
          message: "Document not found or processing hasn't started"
        }), { 
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (pineconeError) {
      console.error("Pinecone query error:", pineconeError);
      
      // If we get a Pinecone error, it might be because the document doesn't exist yet
      // Check if this is a recent document ID that might still be processing
      const timestampMatch = documentId.match(/-(\d+)$/);
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1]);
        const now = Date.now();
        const timeDiff = now - timestamp;
        
        // If document was created within the last 30 minutes, assume it's processing
        if (timeDiff < 30 * 60 * 1000) { // 30 minutes
          return new NextResponse(JSON.stringify({
            status: "processing",
            progress: 0,
            processedChunks: 0,
            totalChunks: 0,
            message: "Document is being processed. Embeddings are being generated..."
          }), { 
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      throw pineconeError; // Re-throw if not a recent document
    }

  } catch (_error) {
    console.error("Error checking document status:", _error);
    return new NextResponse(JSON.stringify({ 
      error: "Internal server error",
      message: _error instanceof Error ? _error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 