import { NextRequest, NextResponse } from 'next/server';
import { PCA } from 'ml-pca';
// @ts-ignore - ml-kmeans doesn't have type definitions
import { kmeans } from 'ml-kmeans';

interface EmbeddingPoint {
  vector: number[];
  metadata: {
    text: string;
    [key: string]: any;
  };
}

export async function POST(req: NextRequest) {
  try {
    const { embeddings } = await req.json() as { embeddings: EmbeddingPoint[] };

    if (!embeddings || !Array.isArray(embeddings)) {
      return NextResponse.json(
        { error: 'Invalid embeddings data' },
        { status: 400 }
      );
    }

    // Extract vectors for PCA
    const vectors = embeddings.map(e => e.vector);

    // Perform PCA to reduce dimensions to 3
    const pca = new PCA(vectors);
    const reducedVectors = pca.predict(vectors, { nComponents: 3 }).to2DArray();

    // Perform k-means clustering
    const numClusters = Math.min(15, Math.floor(vectors.length / 10));
    const { clusters } = kmeans(vectors, numClusters, {
      initialization: 'kmeans++',
      seed: 42
    });

    // Scale the coordinates for better visualization
    const points = reducedVectors.map((coords, i) => ({
      x: coords[0] * 20,
      y: coords[1] * 20,
      z: coords[2] * 20,
      cluster: clusters[i],
      label: embeddings[i].metadata.text
    }));

    return NextResponse.json({ points });
  } catch (error) {
    console.error('Error processing embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to process embeddings' },
      { status: 500 }
    );
  }
} 