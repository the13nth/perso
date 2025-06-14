import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Pinecone } from "@pinecone-database/pinecone";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import * as admin from 'firebase-admin';
import { adminDb } from "@/lib/firebase/admin";
import { DocumentStatus } from '@/types/document';
import { RecordMetadata } from "@pinecone-database/pinecone";

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

interface ActivityMetadata extends RecordMetadata {
  text: string;
  activityId: string;
  userId: string;
  chunkIndex: number;
  totalChunks: number;
  title: string;
  activity: string;
  category: string;
  categories: string[];
  type: 'activity';
  source: 'user';
  activityDate: string;
  duration: string;
  location: string;
}

export async function POST(req: NextRequest) {
  let activityId: string | null = null;
  
  try {
    console.log("[POST] Starting activity ingestion...");

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
    const { text, activity, category, structuredData } = await req.json();
    console.log("[POST] Request body:", { text: text?.length, activity, category });

    // Validate required fields
    if (!text?.trim() || !activity || !category || !structuredData) {
      console.log("[POST] Validation failed: Missing required fields");
      return NextResponse.json({ 
        error: "Activity details, activity type, category, and structured data are required" 
      }, { status: 400 });
    }

    // Generate unique activity ID
    activityId = `activity-${userId}-${Date.now()}`;
    console.log("[POST] Activity ID generated:", activityId);

    // Create activity title
    const activityName = activity.charAt(0).toUpperCase() + activity.slice(1).replace(/_/g, ' ');
    const activityDateFormatted = structuredData.activityDate ? new Date(structuredData.activityDate).toLocaleDateString() : '';
    const title = `${activityName}${structuredData.duration ? ` - ${structuredData.duration}` : ''}${activityDateFormatted ? ` (${activityDateFormatted})` : ''}`;

    // Create initial activity in Firestore
    console.log("[POST] Creating activity in Firestore...");
    const docRef = adminDb.collection('activities').doc(activityId);
    await docRef.set({
      id: activityId,
      userId,
      text,
      title,
      activity,
      category,
      categories: [category, activity],
      structuredData,
      status: DocumentStatus.PROCESSING,
      processingProgress: 0,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log("[POST] Activity created successfully");

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
      processingProgress: 10,
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
          const metadata: ActivityMetadata = {
            text: chunk,
            activityId: activityId!,
            userId,
            chunkIndex: i + index,
            totalChunks,
            title,
            activity,
            category,
            categories: [category, activity],
            type: 'activity',
            source: 'user',
            activityDate: structuredData.activityDate || '',
            duration: structuredData.duration || '',
            location: structuredData.location || '',
          };
          return {
            id: `${activityId}-${i + index}`,
            values: embedding,
            metadata
          };
        })
      );
      
      vectors.push(...batchEmbeddings);

      // Update progress
      const progress = Math.min(10 + Math.round(((i + BATCH_SIZE) / chunks.length) * 80), 90);
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

    // Mark activity as completed
    console.log("[POST] Updating activity status to COMPLETED...");
    await docRef.update({
      status: DocumentStatus.COMPLETED,
      processingProgress: 100,
      updatedAt: admin.firestore.Timestamp.now()
    });
    console.log("[POST] Activity processing completed successfully");

    return NextResponse.json({
      success: true,
      activityId,
      chunksProcessed: vectors.length,
      message: "Activity processed and embedded successfully"
    });

  } catch (error) {
    console.error('Error processing activity:', error);
    console.error("[POST] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    
    // Update activity status if we have an activityId
    if (activityId) {
      console.log("[POST] Attempting to update activity status to ERROR...");
      try {
        await adminDb.collection('activities').doc(activityId).update({
          status: DocumentStatus.ERROR,
          processingProgress: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: admin.firestore.Timestamp.now()
        });
      } catch (updateError) {
        console.error("[POST] Failed to update activity status:", updateError);
      }
    }

    return NextResponse.json(
      { 
        error: "Failed to process activity",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 