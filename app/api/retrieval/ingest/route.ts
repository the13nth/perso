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
    
    console.log(`Received document with ${sanitizedText.length} characters`);
    
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

    // Initialize text splitter with appropriate configuration for better chunking
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ["\n\n", "\n", ". ", "! ", "? ", ";", ":", " ", ""],
    });

    // Split text into chunks
    console.log("Splitting text into chunks...");
    const chunks = await splitter.splitText(sanitizedText);
    console.log(`Created ${chunks.length} chunks from document`);

    // Initialize embeddings model with dimension matching Pinecone index
    console.log("Initializing embeddings model...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001"
    });

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Generate embeddings and upsert to Pinecone
    console.log("Generating embeddings and upserting to Pinecone...");
    
    // Add rate limiting to avoid hitting API limits
    const vectors = [];
    const chunkBatchSize = 20; // Smaller batch size for more reliable processing
    
    // Create a unique document ID to group all chunks
    const documentId = `doc-${userId}-${Date.now()}`;
    const createdAt = new Date().toISOString();
    
    // Store original document text in first chunk's metadata
    let originalTextSample = "";
    if (sanitizedText.length > 1000) {
      originalTextSample = sanitizedText.substring(0, 997) + "...";
    } else {
      originalTextSample = sanitizedText;
    }
    
    for (let i = 0; i < chunks.length; i += chunkBatchSize) {
      console.log(`Processing batch ${Math.floor(i/chunkBatchSize) + 1} of ${Math.ceil(chunks.length/chunkBatchSize)}`);
      const batchChunks = chunks.slice(i, i + chunkBatchSize);
      
      // Process each chunk with some delay between each one
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
              categories: documentCategories,
              access: accessLevel,
              documentId, // Add document ID to link chunks
              chunkIndex, // Add chunk index for ordering
              totalChunks: chunks.length,
              createdAt,
              ...(chunkIndex === 0 ? { 
                originalTextSample,
                title: extractTitle(sanitizedText)
              } : {})
            },
          });
          
          // Add a small delay between each API call
          if (j < batchChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
        } catch (error) {
          console.error(`Error generating embedding for chunk ${chunkIndex+1}:`, error);
          // Simple exponential backoff
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay on error
          j--; // Retry this item
        }
      }
      
      // Add a delay between batches
      if (i + chunkBatchSize < chunks.length) {
        console.log("Pausing between batches to avoid rate limits...");
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3s pause between batches
      }
    }

    console.log(`Successfully generated ${vectors.length} vectors for document`);
    
    // Upsert vectors in smaller batches for reliability
    const upsertBatchSize = 50;
    for (let i = 0; i < vectors.length; i += upsertBatchSize) {
      const batch = vectors.slice(i, i + upsertBatchSize);
      console.log(`Upserting batch ${Math.floor(i/upsertBatchSize) + 1} of ${Math.ceil(vectors.length/upsertBatchSize)}`);
      
      try {
        await index.upsert(batch);
        console.log(`Successfully upserted batch of ${batch.length} vectors`);
      } catch (error) {
        console.error(`Error upserting batch to Pinecone:`, error);
        // Retry with smaller batch if there's an error
        if (batch.length > 10) {
          console.log("Retrying with smaller batches...");
          for (let j = 0; j < batch.length; j += 10) {
            const smallerBatch = batch.slice(j, j + 10);
            try {
              await index.upsert(smallerBatch);
              console.log(`Successfully upserted smaller batch of ${smallerBatch.length} vectors`);
            } catch (smallerError) {
              console.error(`Error upserting smaller batch:`, smallerError);
            }
            // Add delay between smaller batch upserts
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      // Add a small delay between Pinecone batches
      if (i + upsertBatchSize < vectors.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Successfully ingested document with ${chunks.length} chunks`);
    return new NextResponse(JSON.stringify({ 
      success: true,
      message: `Document processed successfully. Created ${chunks.length} chunks.`,
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
