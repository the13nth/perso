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

const BATCH_SIZE = 1000;

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

    // Get Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Get query parameters
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build filter
    const filter: Record<string, any> = {
      userId: { $eq: userId }
    };
    
    if (type && type !== 'all') {
      filter.type = { $eq: type };
    }

    // Query Pinecone with pagination and filtering
    const queryResponse = await index.query({
      vector: new Array(768).fill(0), // Dummy vector of zeros
      topK: limit,
      filter: filter,
      includeValues: false, // Don't include vector values
      includeMetadata: true
    });

    // Extract and format metadata
    const metadata = queryResponse.matches?.map(match => ({
      id: match.id,
      metadata: match.metadata
    })) || [];

    return NextResponse.json({
      items: metadata,
      page,
      limit,
      total: metadata.length, // Note: Pinecone doesn't provide total count
      hasMore: metadata.length === limit // If we got limit items, there might be more
    });

  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: "Failed to fetch metadata" },
      { status: 500 }
    );
  }
} 