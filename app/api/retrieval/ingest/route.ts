import { NextRequest } from 'next/server';
import { NoteIngestion } from '@/app/lib/content/ingestion/NoteIngestion';
import { processDocument } from '@/app/lib/retrieval/documentProcessor';
import { DocumentInput } from '@/app/lib/retrieval/types';

// Use Node.js runtime
export const runtime = 'nodejs';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY environment variable");
}

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error("Missing PINECONE_ENVIRONMENT environment variable");
}

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into Pinecone using Gemini embeddings for retrieval.
 * 
 * For large documents, it processes in smaller batches to avoid timeouts.
 */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate input
    if (!data.content || !data.userId) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Create document input
    const documentInput: DocumentInput = {
      id: `doc-${data.userId}-${Date.now()}`,
      content: data.content,
      metadata: data.metadata || {},
      type: data.type || 'document',
      userId: data.userId
    };

    // Process document
    const processor = new NoteIngestion();
    await processDocument(documentInput, processor);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing document:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
