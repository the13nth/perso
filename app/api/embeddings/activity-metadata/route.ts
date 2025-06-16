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

    // Get activity ID from query params
    const url = new URL(req.url);
    const activityId = url.searchParams.get('activityId');
    
    if (!activityId) {
      return NextResponse.json(
        { error: "activityId is required" },
        { status: 400 }
      );
    }

    // Query Pinecone for vectors with matching activityId
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // First get a sample vector to use for querying
    const sampleVector = new Array(768).fill(0); // Using standard dimensions
    
    const queryResponse = await index.query({
      vector: sampleVector,
      filter: {
        activityId: { $eq: activityId },
        userId: { $eq: userId }
      },
      topK: 100,
      includeMetadata: true,
      includeValues: true
    });

    // No embeddings found
    if (!queryResponse.matches?.length) {
      return NextResponse.json({ metadata: null });
    }

    // Calculate metadata from matches
    const totalChunks = queryResponse.matches.length;
    
    // Check if first match and its values exist
    const firstMatch = queryResponse.matches[0];
    const embeddingDimensions = firstMatch?.values?.length ?? 768; // Default to standard dimension if not available
    
    // Get last updated timestamp
    const timestamps = queryResponse.matches
      .map(match => match.metadata?.timestamp)
      .filter((timestamp): timestamp is string => typeof timestamp === 'string')
      .sort()
      .reverse();
    
    const lastUpdated = timestamps.length > 0 ? timestamps[0] : null;

    return NextResponse.json({
      metadata: {
        totalChunks,
        embeddingDimensions,
        lastUpdated
      }
    });

  } catch (error) {
    console.error('Error fetching activity metadata:', error);
    return NextResponse.json(
      { error: "Failed to fetch activity metadata" },
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

    // Get activity ID from query params
    const url = new URL(req.url);
    const activityId = url.searchParams.get('activityId');
    
    if (!activityId) {
      return NextResponse.json(
        { error: "activityId is required" },
        { status: 400 }
      );
    }

    // Delete vectors from Pinecone
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    await index.deleteMany({
      filter: {
        activityId: { $eq: activityId },
        userId: { $eq: userId }
      }
    });

    return NextResponse.json({ 
      success: true,
      message: "Activity embeddings deleted successfully" 
    });

  } catch (error) {
    console.error('Error deleting activity embeddings:', error);
    return NextResponse.json(
      { error: "Failed to delete activity embeddings" },
      { status: 500 }
    );
  }
} 