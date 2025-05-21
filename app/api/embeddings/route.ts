export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST;

    if (!apiKey || !host) {
      console.error("Missing Pinecone configuration:", {
        hasApiKey: !!apiKey,
        hasHost: !!host
      });
      return NextResponse.json(
        { error: "Missing Pinecone configuration" },
        { status: 500 }
      );
    }

    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Query the index directly using the host
    const queryResponse = await fetch(
      `https://${cleanHost}/query`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: new Array(768).fill(0), // Match index dimension of 768
          topK: 100,
          includeMetadata: true,
          includeValues: true,
          filter: {
            userId: userId
          }
        }),
      }
    );

    if (!queryResponse.ok) {
      const errorData = await queryResponse.text();
      console.error("Pinecone query failed:", errorData);
      return NextResponse.json(
        { error: "Failed to query vectors" },
        { status: queryResponse.status }
      );
    }

    const data = await queryResponse.json();

    // Extract vectors and metadata
    const embeddings = (data.matches || []).map((match: any) => ({
      id: match.id,
      vector: match.values,
      metadata: match.metadata
    }));

    return NextResponse.json({ embeddings });
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    return NextResponse.json(
      { error: "Failed to fetch embeddings" },
      { status: 500 }
    );
  }
} 