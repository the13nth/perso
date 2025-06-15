import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get document ID from query params
    const url = new URL(req.url);
    const fileName = url.searchParams.get('fileName');
    
    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Query Pinecone for document metadata
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    const queryResponse = await index.query({
      vector: new Array(768).fill(0), // Required for querying, using zero vector since we only need metadata
      filter: {
        userId,
        fileName
      },
      topK: 1000, // Increased to get all chunks for the file
      includeMetadata: true
    });

    if (!queryResponse.matches?.length) {
      return NextResponse.json({
        metadata: null
      });
    }

    // Count unique chunks and get the most recent timestamp
    const totalChunks = queryResponse.matches.length;
    const lastUpdated = queryResponse.matches.reduce<string | null>((latest, match) => {
      const matchTimestamp = match.metadata?.updatedAt as string | undefined;
      if (!latest || (matchTimestamp && matchTimestamp > latest)) {
        return matchTimestamp || null;
      }
      return latest;
    }, null);

    const metadata = {
      totalChunks,
      embeddingDimensions: 768, // Standard for our embeddings
      lastUpdated
    };

    return NextResponse.json({ metadata });
  } catch (error) {
    console.error("Error fetching document metadata:", error);
    return NextResponse.json(
      { error: "Failed to fetch document metadata" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get fileName from request body
    const { fileName } = await req.json();
    
    if (!fileName) {
      return NextResponse.json(
        { error: "fileName is required" },
        { status: 400 }
      );
    }

    // Delete vectors from Pinecone
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    await index.deleteMany({
      filter: {
        userId,
        fileName
      }
    });

    return NextResponse.json({
      success: true,
      message: "Embeddings deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting embeddings:", error);
    return NextResponse.json(
      { error: "Failed to delete embeddings" },
      { status: 500 }
    );
  }
} 