import { NextResponse } from 'next/server';
import { PCA } from 'ml-pca';

export async function POST(req: Request) {
  console.log('Processing vectors request received');
  
  try {
    const body = await req.json();
    const { vectors } = body;
    
    if (!vectors || !Array.isArray(vectors) || vectors.length === 0) {
      console.error('Invalid vectors data:', { 
        hasVectors: !!vectors,
        isArray: Array.isArray(vectors),
        length: vectors?.length 
      });
      return NextResponse.json({ error: 'Invalid vectors data' }, { status: 400 });
    }

    console.log(`Processing ${vectors.length} vectors`);

    // Validate vector dimensions
    const dimension = vectors[0].length;
    if (!vectors.every(v => Array.isArray(v) && v.length === dimension)) {
      console.error('Inconsistent vector dimensions');
      return NextResponse.json({ error: 'Inconsistent vector dimensions' }, { status: 400 });
    }

    // Validate vector values
    if (!vectors.every(v => v.every((n: number) => typeof n === 'number' && !isNaN(n)))) {
      console.error('Invalid vector values detected');
      return NextResponse.json({ error: 'Invalid vector values' }, { status: 400 });
    }

    // Perform PCA with error handling
    let pca: PCA;
    try {
      pca = new PCA(vectors);
    } catch (_error) {
      console.error('PCA initialization failed:', _error);
      return NextResponse.json({ error: 'PCA initialization failed' }, { status: 500 });
    }

    let reducedVectors: number[][];
    try {
      reducedVectors = pca.predict(vectors, { nComponents: 3 }).to2DArray();
    } catch (_error) {
      console.error('PCA prediction failed:', _error);
      return NextResponse.json({ error: 'PCA prediction failed' }, { status: 500 });
    }

    // Scale the vectors
    const coordinates = reducedVectors.map(v => ({
      x: v[0] * 8.0,
      y: v[1] * 8.0,
      z: v[2] * 8.0
    }));

    console.log('Vector processing completed successfully');
    
    return NextResponse.json({ coordinates });
  } catch (_error) {
    console.error('Error processing vectors:', _error);
    return NextResponse.json(
      { error: 'Failed to process vectors', details: _error instanceof Error ? _error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 