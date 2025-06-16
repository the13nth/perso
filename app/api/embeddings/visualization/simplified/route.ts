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

interface VectorMetadata {
  type?: string;
  documentId?: string;
  noteId?: string;
  activityId?: string;
  title?: string;
  text?: string;
  userId?: string;
  fileName?: string;
  category?: string;
  categories?: string[] | string;
  docType?: string;
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

    // Group vectors by their parent document/note/activity
    const groupedVectors: Record<string, {
      type: 'document' | 'note' | 'activity';
      category: string;
      vectors: number[][];
      metadata: {
        id: string;
        title: string;
        text: string;
      };
    }> = {};

    // Process and group vectors
    queryResponse.matches.forEach((match) => {
      if (!match.values || !Array.isArray(match.values)) return;

      const meta = match.metadata as VectorMetadata;
      let groupId: string | undefined;
      let type: 'document' | 'note' | 'activity' | undefined;
      let title: string | undefined;
      
      // Determine category
      let category = 'Uncategorized';
      if (meta.category) {
        category = meta.category;
      } else if (meta.categories) {
        if (Array.isArray(meta.categories) && meta.categories.length > 0) {
          category = meta.categories[0];
        } else if (typeof meta.categories === 'string') {
          try {
            const parsed = JSON.parse(meta.categories);
            category = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : meta.categories;
          } catch {
            category = meta.categories;
          }
        }
      } else if (meta.docType) {
        category = meta.docType;
      }

      if (meta.documentId || (meta.type === 'document')) {
        groupId = meta.documentId || meta.fileName;
        type = 'document';
        title = meta.fileName || meta.title || 'Untitled Document';
      } else if (meta.noteId || (meta.type === 'note')) {
        groupId = meta.noteId;
        type = 'note';
        title = meta.title || 'Untitled Note';
      } else if (meta.activityId || (meta.type === 'activity')) {
        groupId = meta.activityId;
        type = 'activity';
        title = meta.title || 'Untitled Activity';
      }

      if (!groupId || !type) return;

      if (!groupedVectors[groupId]) {
        groupedVectors[groupId] = {
          type,
          category,
          vectors: [],
          metadata: {
            id: groupId,
            title: title || 'Untitled',
            text: meta.text || 'No preview available'
          }
        };
      }

      groupedVectors[groupId].vectors.push(match.values);
    });

    // Calculate average vectors for each group
    const points = Object.entries(groupedVectors).map(([id, group]) => {
      // Calculate average vector
      const avgVector = group.vectors.reduce((acc, vector) => {
        return acc.map((val, i) => val + vector[i]);
      }, new Array(768).fill(0)).map(val => val / group.vectors.length);

      return {
        vector: avgVector,
        type: group.type,
        category: group.category,
        metadata: group.metadata
      };
    });

    // Apply PCA to the averaged vectors
    let reduced: number[][];
    if (points.length === 0) {
      reduced = [];
    } else if (points.length === 1) {
      reduced = [[0, 0, 0]];
    } else if (points.length === 2) {
      reduced = [[-1, 0, 0], [1, 0, 0]];
    } else {
      try {
        const vectors = points.map(p => p.vector);
        const pca = new PCA(vectors);
        reduced = pca.predict(vectors, { nComponents: 3 }).to2DArray();
      } catch (pcaError) {
        console.error("[Simplified Visualization] PCA failed:", pcaError);
        // Fallback to simple projection if PCA fails
        reduced = points.map(p => [p.vector[0] || 0, p.vector[1] || 0, p.vector[2] || 0]);
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
        type: points[i].type,
        category: points[i].category,
        metadata: points[i].metadata
      }))
    });

  } catch (error) {
    console.error("Error in simplified visualization endpoint:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 