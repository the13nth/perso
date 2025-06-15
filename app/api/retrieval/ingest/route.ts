import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import * as admin from 'firebase-admin';
import { adminDb } from "@/lib/firebase/admin";
import { DocumentStatus } from '@/types/document';
import pdf from 'pdf-parse';

// Use Node.js runtime
export const runtime = 'nodejs';

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY environment variable");
}

// Initialize services once
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY || "",
  modelName: "embedding-001"
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

// Constants
const BATCH_SIZE = 100;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

interface DocumentMetadata extends RecordMetadata {
  text: string;
  documentId: string;
  userId: string;
  chunkIndex: number;
  totalChunks: number;
  title: string;
  categories: string[];
  type: 'document';
  source: 'user';
  access: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    console.log("[extractTextFromPDF] Fetching PDF from:", fileUrl);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("[extractTextFromPDF] PDF fetched, size:", buffer.length);
    
    const data = await pdf(buffer);
    console.log("[extractTextFromPDF] Text extracted, length:", data.text.length);
    
    return data.text;
  } catch (error) {
    console.error("[extractTextFromPDF] Error:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function extractTextFromDocument(fileUrl: string, fileType: string): Promise<string> {
  console.log("[extractTextFromDocument] Processing file type:", fileType);
  
  switch (fileType) {
    case 'application/pdf':
      return extractTextFromPDF(fileUrl);
      
    case 'text/plain':
    case 'text/markdown':
    case 'text/csv':
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch text file: ${response.statusText}`);
      }
      return response.text();
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

export async function POST(req: NextRequest) {
  let documentId = '';
  
  try {
    console.log("[POST] Starting document ingestion...");

    // Check authentication
    console.log("[POST] Checking authentication...");
    const { userId } = await auth();
    if (!userId) {
      console.log("[POST] Authentication failed: No userId");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.log("[POST] Authentication successful. userId:", userId);

    // Parse and validate request body
    console.log("[POST] Parsing request body...");
    const { documentId: reqDocumentId, metadata } = await req.json();
    console.log("[POST] Request body:", { documentId: reqDocumentId, metadata });

    // Validate required fields
    if (!reqDocumentId || !metadata?.fileUrl) {
      console.log("[POST] Validation failed: Missing required fields");
      return NextResponse.json({ 
        error: "Document ID and file URL are required" 
      }, { status: 400 });
    }

    documentId = reqDocumentId;

    // Create initial document in Firestore
    console.log("[POST] Creating document in Firestore...");
    const docRef = adminDb.collection('documents').doc(documentId);
    await docRef.set({
      id: documentId,
      ...metadata,
      processingProgress: 0,
      status: DocumentStatus.PROCESSING,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log("[POST] Document created successfully");

    // Extract text from document
    console.log("[POST] Extracting text from document...");
    const text = await extractTextFromDocument(metadata.fileUrl, metadata.fileType);
    if (!text?.trim()) {
      throw new Error("No text content extracted from document");
    }
    console.log("[POST] Text extracted successfully, length:", text.length);

    // Update progress
    await docRef.update({
      processingProgress: 20,
      textLength: text.length
    });

    // Split text into chunks
    console.log("[POST] Splitting text into chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP
    });
    const chunks = await splitter.splitText(text);
    const totalChunks = chunks.length;
    console.log("[POST] Text split into chunks:", totalChunks);

    // Update progress
    await docRef.update({
      processingProgress: 30,
      totalChunks
    });

    // Process chunks in batches
    const vectors = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      
      // Generate embeddings for batch
      console.log(`[POST] Generating embeddings for batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`);
      const batchEmbeddings = await Promise.all(
        batchChunks.map(async (chunk, index) => {
          const embedding = await embeddings.embedQuery(chunk);
          const docMetadata: DocumentMetadata = {
            text: chunk,
            documentId,
            userId,
            chunkIndex: i + index,
            totalChunks,
            title: metadata.fileName || 'Untitled Document',
            categories: metadata.categories || ['general'],
            type: 'document',
            source: 'user',
            access: metadata.access || 'personal',
            fileName: metadata.fileName,
            fileType: metadata.fileType,
            fileSize: metadata.fileSize,
            uploadedAt: metadata.uploadedAt
          };
          return {
            id: `${documentId}-${i + index}`,
            values: embedding,
            metadata: docMetadata
          };
        })
      );
      
      vectors.push(...batchEmbeddings);

      // Update progress
      const progress = Math.min(30 + Math.round(((i + BATCH_SIZE) / chunks.length) * 60), 90);
      await docRef.update({ processingProgress: progress });
    }

    // Store vectors in Pinecone
    console.log("[POST] Storing vectors in Pinecone...");
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Upload vectors in batches
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      console.log(`[POST] Uploading batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(vectors.length/BATCH_SIZE)}`);
      await index.upsert(batch);
      
      // Update progress for vector storage
      const progress = Math.min(90 + Math.round((i / vectors.length) * 10), 100);
      await docRef.update({ processingProgress: progress });
    }

    // Mark document as completed
    console.log("[POST] Updating document status to COMPLETED...");
    await docRef.update({
      status: DocumentStatus.COMPLETED,
      processingProgress: 100,
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log("[POST] Document processing completed successfully");

    return NextResponse.json({
      success: true,
      documentId,
      chunksProcessed: vectors.length,
      message: "Document processed and embedded successfully"
    });

  } catch (error) {
    console.error('Error processing document:', error);
    console.error("[POST] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Update document status if we have a documentId
    if (documentId) {
      console.log("[POST] Attempting to update document status to ERROR...");
      try {
        await adminDb.collection('documents').doc(documentId).update({
          status: DocumentStatus.ERROR,
          processingProgress: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: admin.firestore.Timestamp.now()
        });
      } catch (updateError) {
        console.error("[POST] Failed to update document status:", updateError);
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to process document",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

