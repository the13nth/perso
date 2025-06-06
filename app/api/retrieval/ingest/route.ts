import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

// Remove edge runtime since we need Node.js features
// export const runtime = "edge";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!process.env.PINECONE_INDEX) {
  throw new Error("Missing PINECONE_INDEX environment variable");
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error("Missing PINECONE_ENVIRONMENT environment variable");
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * Sanitizes text to ensure it's valid UTF-8 and removes problematic characters
 */
function sanitizeText(text: string): string {
  // Replace null characters and other control characters
   
  let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Replace non-printable characters outside standard ASCII
  sanitized = sanitized.replace(/[\x80-\x9F]/g, '');
  
  // Remove any remaining binary garbage by enforcing valid UTF-8
  sanitized = sanitized
    .split('')
    .filter(char => {
      const code = char.charCodeAt(0);
      return code >= 32 || [9, 10, 13].includes(code); // Allow tab, newline, carriage return
    })
    .join('');
  
  // Normalize whitespace (multiple spaces/newlines to single)
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim excess whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
}

/**
 * This handler takes input text, splits it into chunks, and embeds those chunks
 * into Pinecone using Gemini embeddings for retrieval.
 * 
 * For large documents, it processes in smaller batches to avoid timeouts.
 */
export async function POST(req: NextRequest) {
  try {
    console.log("Starting document ingestion process...");

    // Check authentication first
    console.log("Checking authentication...");
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the input text from the request
    const { text, category, categories, access } = await req.json();
    if (!text) {
      return new NextResponse("Missing text in request body", { status: 400 });
    }

    // Sanitize the input text to ensure it's clean UTF-8
    const sanitizedText = sanitizeText(text);
    const textLength = sanitizedText.length;
    
    console.log(`Received document with ${textLength} characters`);
    
    // Check if we're in production/online deployment
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.NETLIFY === 'true' || 
                        process.env.VERCEL === '1' ||
                        process.env.RAILWAY_ENVIRONMENT ||
                        process.env.RENDER;
    
    // Document size limits for online deployments
    const MAX_DOCUMENT_SIZE_PRODUCTION = 1000000; // 1MB for production free tier
    
    // Enforce document size limits for online deployments only
    if (isProduction && textLength > MAX_DOCUMENT_SIZE_PRODUCTION) {
      console.log(`Document too large for production: ${textLength} characters (max: ${MAX_DOCUMENT_SIZE_PRODUCTION})`);
      return new NextResponse(JSON.stringify({ 
        error: "Document too large",
        message: `Document size (${Math.round(textLength/1000)}KB) exceeds the maximum allowed size of ${Math.round(MAX_DOCUMENT_SIZE_PRODUCTION/1000)}KB for the free tier. Please upgrade to our Pro plan for unlimited document processing, split your document into smaller parts, or use the application locally.`,
        maxSize: MAX_DOCUMENT_SIZE_PRODUCTION,
        currentSize: textLength,
        isProduction: true,
        upgradeRequired: true
      }), {
        status: 413, // Payload Too Large
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Handle both single category (legacy) and multiple categories
    let documentCategories: string[] = [];
    
    if (categories && Array.isArray(categories) && categories.length > 0) {
      documentCategories = categories;
    } else if (category) {
      documentCategories = [category];
    } else {
      documentCategories = ["general"];
    }
    
    // Set access level (default to personal if not specified)
    const accessLevel = access === "public" ? "public" : "personal";

    // Create a unique document ID to group all chunks
    const documentId = `doc-${userId}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    // For large documents, use async processing (only for local development)
    // In production, documents are already limited to smaller sizes
    // For local development, no size limit but use async processing for documents > 50KB
    const asyncThreshold = isProduction ? MAX_DOCUMENT_SIZE_PRODUCTION : 50000; // 50KB for local
    const isLargeDocument = !isProduction && textLength > asyncThreshold;
    
    if (isLargeDocument) {
      console.log("Large document detected, returning 202 Accepted");
      
      // Start processing in the background without awaiting completion
      processDocumentAsync(
        sanitizedText,
        userId,
        documentCategories,
        accessLevel,
        documentId,
        createdAt
      ).catch(error => {
        console.error("Background processing error:", error);
      });
      
      // Return immediately with a 202 Accepted status
      return new NextResponse(JSON.stringify({ 
        success: true,
        processing: true,
        message: "Large document accepted for processing. This may take a few minutes.",
        documentId
      }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // For smaller documents, process synchronously
    const result = await processDocument(
      sanitizedText, 
      userId,
      documentCategories,
      accessLevel,
      documentId,
      createdAt
    );
    
    return new NextResponse(JSON.stringify({ 
      success: true,
      message: `Document processed successfully. Created ${result.chunkCount} chunks.`,
      documentId
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in document ingestion:", error);
    return new NextResponse(JSON.stringify({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Process document asynchronously (for large documents)
 */
async function processDocumentAsync(
  text: string,
  userId: string,
  categories: string[],
  access: string,
  documentId: string,
  createdAt: string
): Promise<void> {
  try {
    await processDocument(text, userId, categories, access, documentId, createdAt);
    console.log(`Background processing completed for document: ${documentId}`);
  } catch (error) {
    console.error(`Background processing failed for document: ${documentId}`, error);
  }
}

/**
 * Core document processing function
 */
async function processDocument(
  text: string,
  userId: string,
  categories: string[],
  access: string,
  documentId: string,
  createdAt: string
): Promise<{ chunkCount: number }> {
  // Initialize text splitter with smaller chunk size for more reliable processing
    const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 150,
      separators: ["\n\n", "\n", ". ", "! ", "? ", ";", ":", " ", ""],
    });

    // Split text into chunks
    console.log("Splitting text into chunks...");
  const chunks = await splitter.splitText(text);
    console.log(`Created ${chunks.length} chunks from document`);

  // Initialize embeddings model
    console.log("Initializing embeddings model...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001"
    });

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

  // Process in very small batches to avoid timeouts
    const vectors = [];
  const chunkBatchSize = 5; // Much smaller batch for more reliable processing
    
    // Store original document text in first chunk's metadata
    let originalTextSample = "";
  if (text.length > 1000) {
    originalTextSample = text.substring(0, 997) + "...";
    } else {
    originalTextSample = text;
    }
    
    for (let i = 0; i < chunks.length; i += chunkBatchSize) {
      console.log(`Processing batch ${Math.floor(i/chunkBatchSize) + 1} of ${Math.ceil(chunks.length/chunkBatchSize)}`);
      const batchChunks = chunks.slice(i, i + chunkBatchSize);
      
    // Process each chunk with significant delay between each one
      for (let j = 0; j < batchChunks.length; j++) {
        const chunkIndex = i + j;
        let chunkText = batchChunks[j];
        
        // Final verification of chunk text - sanitize again if needed
        if (typeof chunkText !== 'string') {
          console.warn(`Invalid chunk text at index ${chunkIndex}, converting to string`);
          chunkText = String(chunkText);
        }
        
        // Double-check for clean text
        chunkText = sanitizeText(chunkText);
        
        try {
          console.log(`Generating embedding for chunk ${chunkIndex+1}/${chunks.length} (${chunkText.length} chars)`);
          
          const embedding = await embeddings.embedQuery(chunkText);
          
          // Create vector with detailed metadata
          vectors.push({
            id: `${documentId}-chunk-${chunkIndex}`,
            values: embedding,
            metadata: {
              text: chunkText,
              userId,
            categories,
            access,
            documentId,
            chunkIndex,
              totalChunks: chunks.length,
              createdAt,
              ...(chunkIndex === 0 ? { 
                originalTextSample,
              title: extractTitle(text)
              } : {})
            },
          });
          
          // Add a small delay between each API call
          if (j < batchChunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
          }
        } catch (error) {
          console.error(`Error generating embedding for chunk ${chunkIndex+1}:`, error);
          // Simple exponential backoff
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay on error
          j--; // Retry this item
        }
      }
      
    // Add a significant delay between batches
      if (i + chunkBatchSize < chunks.length) {
        console.log("Pausing between batches to avoid rate limits...");
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s pause between batches
      }
    }

    console.log(`Successfully generated ${vectors.length} vectors for document`);
    
    // Upsert vectors in smaller batches for reliability
  const upsertBatchSize = 10; // Even smaller batch size for upserting
    for (let i = 0; i < vectors.length; i += upsertBatchSize) {
      const batch = vectors.slice(i, i + upsertBatchSize);
      console.log(`Upserting batch ${Math.floor(i/upsertBatchSize) + 1} of ${Math.ceil(vectors.length/upsertBatchSize)}`);
      
      try {
        await index.upsert(batch);
        console.log(`Successfully upserted batch of ${batch.length} vectors`);
      } catch (error) {
        console.error(`Error upserting batch to Pinecone:`, error);
        // Retry with smaller batch if there's an error
      if (batch.length > 5) {
          console.log("Retrying with smaller batches...");
        for (let j = 0; j < batch.length; j += 5) {
          const smallerBatch = batch.slice(j, j + 5);
            try {
              await index.upsert(smallerBatch);
              console.log(`Successfully upserted smaller batch of ${smallerBatch.length} vectors`);
            } catch (smallerError) {
              console.error(`Error upserting smaller batch:`, smallerError);
            }
            // Add delay between smaller batch upserts
          await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
    // Add a significant delay between Pinecone batches
      if (i + upsertBatchSize < vectors.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`Successfully ingested document with ${chunks.length} chunks`);
  return { chunkCount: chunks.length };
}

/**
 * Extracts a title from the beginning of the text
 */
function extractTitle(text: string): string {
  // Try to find a title from the first line or sentence
  const firstLine = text.split('\n')[0].trim();
  
  if (firstLine.length > 0 && firstLine.length <= 100) {
    return firstLine;
  }
  
  const firstSentence = text.split(/[.!?]/)[0].trim();
  if (firstSentence.length > 0 && firstSentence.length <= 100) {
    return firstSentence;
  }
  
  // If no good title found, use the first 50 characters
  return text.substring(0, 50) + (text.length > 50 ? '...' : '');
}
