import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

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

    const apiKey = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST;

    if (!apiKey || !host) {
      return NextResponse.json(
        { error: "Missing Pinecone configuration" },
        { status: 500 }
      );
    }

    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Query the index to get all user's documents and extract categories
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
          topK: 10000, // Get a large number to capture all categories
          includeMetadata: true,
          includeValues: false, // We don't need the actual vectors
          filter: { userId }
        }),
      }
    );

    if (!queryResponse.ok) {
      return NextResponse.json(
        { error: "Failed to query categories" },
        { status: queryResponse.status }
      );
    }

    const data = await queryResponse.json();
    
    // Extract all unique categories from metadata
    const categorySet = new Set<string>();
    const categoryStats: Record<string, number> = {};
    
    (data.matches || []).forEach((match: any) => {
      const metadata = match.metadata || {};
      let categories: string[] = [];
      
      // Handle different category formats
      if (metadata.categories) {
        if (Array.isArray(metadata.categories)) {
          categories = metadata.categories;
        } else if (typeof metadata.categories === 'string') {
          try {
            const parsed = JSON.parse(metadata.categories);
            categories = Array.isArray(parsed) ? parsed : [metadata.categories];
          } catch {
            categories = [metadata.categories];
          }
        }
      } else if (metadata.category) {
        categories = [metadata.category];
      } else if (metadata.type) {
        // Use content type as fallback category
        categories = [metadata.type];
      }
      
      // Add categories to set and count occurrences
      categories.forEach(cat => {
        if (cat && typeof cat === 'string') {
          categorySet.add(cat);
          categoryStats[cat] = (categoryStats[cat] || 0) + 1;
        }
      });
    });

    // Convert to array and sort by usage count (most used first)
    const categoriesArray = Array.from(categorySet)
      .map(category => ({
        name: category,
        count: categoryStats[category] || 0
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      categories: categoriesArray,
      totalDocuments: data.matches?.length || 0
    });

  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
} 