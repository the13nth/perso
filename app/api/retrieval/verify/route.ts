import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

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
 * API endpoint to verify document extraction and ingestion.
 * Lists recently uploaded documents for a user, including sample text.
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const includeText = searchParams.get("includeText") === "true";
    const documentId = searchParams.get("documentId") || null;

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Define a better typed query object
    const query: {
      filter: {
        userId: string;
        documentId?: string;
      };
      topK: number;
      includeMetadata: boolean;
    } = {
      filter: {
        userId
      },
      topK: limit,
      includeMetadata: true,
    };

    // If a specific document ID is provided, filter for it
    if (documentId) {
      query.filter.documentId = documentId;
    }

    // Query Pinecone for the user's documents
    const queryResponse = await index.query({
      vector: Array(768).fill(0), // Zero vector to get random results
      ...query
    });

    // Extract unique document IDs
    const documentIds = new Set<string>();
    const documentInfo: Record<string, Record<string, unknown>> = {};

    // Process the matches
    queryResponse.matches.forEach(match => {
      if (match.metadata && match.metadata.documentId) {
        const docId = match.metadata.documentId as string;
        documentIds.add(docId);
        
        // Store document info for the first chunk we encounter
        if (!documentInfo[docId]) {
          // Get the title from metadata if available, otherwise use the first part of text
          const title = 
            match.metadata.title || 
            (match.metadata.text && typeof match.metadata.text === 'string' 
              ? match.metadata.text.substring(0, 50) + '...' 
              : 'Untitled document');
          
          documentInfo[docId] = {
            documentId: docId,
            title,
            categories: match.metadata.categories || [],
            access: match.metadata.access || "personal",
            totalChunks: match.metadata.totalChunks || 0,
            createdAt: match.metadata.createdAt || "",
            sampleText: includeText 
              ? (match.metadata.originalTextSample || match.metadata.text || "No text available")
              : "Text not included (use includeText=true parameter)",
          };
        }
      }
    });

    // If we're asking for a specific document and want all the content
    if (documentId && includeText) {
      try {
        // Get all chunks for this document in order
        const allChunksQuery = await index.query({
          vector: Array(768).fill(0),
          filter: {
            documentId,
            userId
          },
          topK: 100, // Get up to 100 chunks
          includeMetadata: true,
        });
        
        // Sort chunks by index
        const chunks = allChunksQuery.matches
          .filter(match => match.metadata && typeof match.metadata.chunkIndex === 'number')
          .sort((a, b) => (a.metadata?.chunkIndex as number) - (b.metadata?.chunkIndex as number));
        
        // Extract full text from ordered chunks
        if (chunks.length > 0) {
          const fullText = chunks.map(chunk => chunk.metadata?.text || "").join(" ");
          
          if (documentInfo[documentId]) {
            // Replace sample with full text
            documentInfo[documentId].fullText = fullText;
            documentInfo[documentId].chunks = chunks.map(chunk => ({
              chunkIndex: chunk.metadata?.chunkIndex,
              text: chunk.metadata?.text,
            }));
          }
        }
      } catch (error) {
        console.error("Error retrieving full document text:", error);
      }
    }

    // Return the document information
    return NextResponse.json({
      success: true,
      count: documentIds.size,
      documents: Array.from(documentIds).map(id => documentInfo[id])
    });

  } catch (error) {
    console.error("Error verifying document ingestion:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve document information",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * API endpoint to retrieve full document content
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the request body
    const { documentId } = await req.json();
    
    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: "Missing documentId in request body"
      }, { status: 400 });
    }

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Query for all chunks of this document
    const response = await index.query({
      vector: Array(768).fill(0), // Zero vector to get all chunks
      filter: {
        documentId,
        userId // Security: ensure user can only access their own documents
      },
      topK: 100, // Get up to 100 chunks
      includeMetadata: true,
    });

    // Sort chunks by index and extract text
    const chunks = response.matches
      .filter(match => match.metadata && typeof match.metadata.chunkIndex === 'number')
      .sort((a, b) => (a.metadata?.chunkIndex as number) - (b.metadata?.chunkIndex as number));
    
    if (chunks.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Document not found or no chunks available"
      }, { status: 404 });
    }

    // Get document metadata from first chunk
    const firstChunk = chunks[0];
    const metadata = {
      documentId,
      title: firstChunk.metadata?.title || "Untitled",
      categories: firstChunk.metadata?.categories || [],
      access: firstChunk.metadata?.access || "personal",
      totalChunks: firstChunk.metadata?.totalChunks || chunks.length,
      createdAt: firstChunk.metadata?.createdAt || new Date().toISOString(),
    };
    
    // Combine all chunk text
    const fullText = chunks.map(chunk => chunk.metadata?.text || "").join(" ");
    
    return NextResponse.json({
      success: true,
      metadata,
      text: fullText,
      chunks: chunks.map(chunk => ({
        chunkIndex: chunk.metadata?.chunkIndex,
        text: chunk.metadata?.text,
      }))
    });
  } catch (error) {
    console.error("Error retrieving document:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to retrieve document",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 