export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

interface EmbeddingMetadata {
  text?: string;
  categories?: string[] | string;
  category?: string;
  docType?: string;
  userId?: string;
  [key: string]: any;
}

interface NormalizedEmbeddingMetadata extends Omit<EmbeddingMetadata, 'categories'> {
  categories: string[];
}

interface Embedding {
  id: string;
  vector: number[];
  metadata: NormalizedEmbeddingMetadata;
}

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

    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const category = url.searchParams.get('category');

    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Prepare filter with user ID
    const filter: Record<string, any> = { userId };
    
    // Add category filter if specified
    if (category && category !== 'all') {
      filter.categories = { $in: [category] };
    }
    
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
          topK: limit,
          includeMetadata: true,
          includeValues: true,
          filter
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

    // Extract vectors and metadata, ensuring proper category format
    const embeddings: Embedding[] = (data.matches || []).map((match: any) => {
      // Normalize the metadata to handle categories consistently
      const rawMetadata: EmbeddingMetadata = { ...match.metadata };
      let normalizedCategories: string[] = [];
      
      // Handle different category formats
      if (!rawMetadata.categories) {
        // Check if we have a single category field
        if (rawMetadata.category) {
          normalizedCategories = [rawMetadata.category];
        } else if (rawMetadata.docType) {
          normalizedCategories = [rawMetadata.docType];
        } else {
          normalizedCategories = ["Uncategorized"];
        }
      } else if (typeof rawMetadata.categories === 'string') {
        // If categories is a string, try to parse it as JSON first
        try {
          const parsed = JSON.parse(rawMetadata.categories);
          normalizedCategories = Array.isArray(parsed) ? parsed : [rawMetadata.categories];
        } catch {
          // If parsing fails, treat it as a single category
          normalizedCategories = [rawMetadata.categories];
        }
      } else if (Array.isArray(rawMetadata.categories)) {
        normalizedCategories = rawMetadata.categories;
      }
      
      // Create a normalized metadata object with categories as string[]
      const metadata: NormalizedEmbeddingMetadata = {
        ...rawMetadata,
        categories: normalizedCategories
      };
      
      return {
      id: match.id,
      vector: match.values,
        metadata
      };
    });

    // Extract all unique categories for filtering
    const allCategories = new Set<string>();
    embeddings.forEach((emb: Embedding) => {
      emb.metadata.categories.forEach((cat: string) => allCategories.add(cat));
    });

    return NextResponse.json({ 
      embeddings,
      categories: Array.from(allCategories).sort()
    });
  } catch (error) {
    console.error("Error fetching embeddings:", error);
    return NextResponse.json(
      { error: "Failed to fetch embeddings" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST;

    if (!apiKey || !host) {
      return NextResponse.json(
        { error: "Missing Pinecone configuration" },
        { status: 500 }
      );
    }

    // Get the embedding ID from the request
    const { embeddingId } = await req.json();
    if (!embeddingId) {
      return NextResponse.json(
        { error: "Missing embeddingId" },
        { status: 400 }
      );
    }

    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // First, verify the embedding belongs to the user
    const queryResponse = await fetch(
      `https://${cleanHost}/query`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: embeddingId,
          topK: 1,
          includeMetadata: true,
          filter: { userId }
        }),
      }
    );

    if (!queryResponse.ok) {
      return NextResponse.json(
        { error: "Failed to verify embedding ownership" },
        { status: queryResponse.status }
      );
    }

    const queryData = await queryResponse.json();
    if (!queryData.matches || queryData.matches.length === 0) {
      return NextResponse.json(
        { error: "Embedding not found or not owned by user" },
        { status: 404 }
      );
    }

    // Delete the embedding
    const deleteResponse = await fetch(
      `https://${cleanHost}/vectors/delete`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: [embeddingId]
        }),
      }
    );

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.text();
      console.error("Pinecone delete failed:", errorData);
      return NextResponse.json(
        { error: "Failed to delete embedding" },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Embedding deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting embedding:", error);
    return NextResponse.json(
      { error: "Failed to delete embedding" },
      { status: 500 }
    );
  }
} 