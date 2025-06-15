import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { PCA } from 'ml-pca';

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

// Constants
const MAX_VECTORS = 500; // Limit number of vectors for visualization
const CHUNK_SIZE = 100; // Process vectors in chunks for memory efficiency

type ContentType = 'document' | 'note' | 'activity';

interface VectorMetadata {
  type?: string;
  documentId?: string;
  noteId?: string;
  activityId?: string;
  title?: string;
  text?: string;
  userId?: string;
}

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

    // Initialize Pinecone client
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Query vectors for this user with limit
    const queryResponse = await index.query({
      vector: Array(768).fill(0), // Pinecone dimension
      topK: MAX_VECTORS,
      includeMetadata: true,
      includeValues: true,
      filter: { userId }
    });

    console.log(`[Visualization] Found ${queryResponse.matches.length} matches`);

    // Prepare arrays for PCA
    const vectors: number[][] = [];
    const metadata: any[] = [];
    const types: string[] = [];

    // Validate and collect vectors
    queryResponse.matches.forEach((match) => {
      // Skip invalid vectors
      if (!match.values || 
          !Array.isArray(match.values) || 
          match.values.length !== 768 ||
          !match.values.every(v => typeof v === 'number' && isFinite(v))) {
        return;
      }

      // Determine the type from metadata
      let type: ContentType | undefined;
      const meta = match.metadata as VectorMetadata;
      
      if (meta?.type === 'document' || meta?.documentId) {
        type = 'document';
      } else if (meta?.type === 'note' || meta?.noteId) {
        type = 'note';
      } else if (meta?.type === 'activity' || meta?.activityId) {
        type = 'activity';
      }

      if (!type) return;

      vectors.push(match.values);
      types.push(type);
      metadata.push({
        id: meta?.documentId || meta?.noteId || meta?.activityId,
        title: meta?.title || 'Untitled',
        text: typeof meta?.text === 'string' 
          ? meta.text.substring(0, 100) 
          : 'No preview available'
      });
    });

    console.log(`[Visualization] Processing ${vectors.length} valid vectors`);

    // Apply dimensionality reduction
    let reduced: number[][];
    if (vectors.length === 0) {
      reduced = [];
    } else if (vectors.length === 1) {
      reduced = [[0, 0, 0]];
    } else if (vectors.length === 2) {
      reduced = [[-1, 0, 0], [1, 0, 0]];
    } else {
      try {
        // Process vectors in chunks to reduce memory usage
        const chunks: number[][][] = [];
        for (let i = 0; i < vectors.length; i += CHUNK_SIZE) {
          const chunk = vectors.slice(i, i + CHUNK_SIZE);
          
          // Normalize vectors in this chunk
          const normalizedChunk = chunk.map(vector => {
            const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
            return vector.map(val => val / (magnitude || 1)); // Avoid division by zero
          });
          
          chunks.push(normalizedChunk);
        }

        // Combine normalized chunks and perform PCA
        const normalizedVectors = chunks.flat();
        const pca = new PCA(normalizedVectors);
        reduced = pca.predict(normalizedVectors, { nComponents: 3 }).to2DArray();
        console.log("[Visualization] PCA completed successfully");
      } catch (pcaError) {
        console.error("[Visualization] PCA failed:", pcaError);
        // Fallback to simple projection if PCA fails
        reduced = vectors.map(v => [v[0] || 0, v[1] || 0, v[2] || 0]);
      }
    }

    // Scale the results to a reasonable range
    if (reduced.length > 0) {
      const ranges = [0, 1, 2].map(dim => {
        const values = reduced.map(v => v[dim]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        return { min, max: max === min ? min + 1 : max };
      });

      reduced = reduced.map(coords => coords.map((val, dim) => {
        const { min, max } = ranges[dim];
        return (val - min) / (max - min) * 20 - 10; // Scale to [-10, 10]
      }));
    }

    return NextResponse.json({
      points: reduced.map((coords, i) => ({
        x: coords[0],
        y: coords[1],
        z: coords[2],
        type: types[i],
        metadata: metadata[i]
      }))
    });

  } catch (error) {
    console.error("Error in visualization endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 