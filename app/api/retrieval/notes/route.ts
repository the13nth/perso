import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { auth } from "@clerk/nextjs/server";
import { Pinecone } from "@pinecone-database/pinecone";

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
 * This handler takes a note text, embeds it, and stores it in Pinecone for retrieval.
 * Notes are stored as single units (no chunking) with type="note" in metadata.
 */
export async function POST(req: NextRequest) {
  try {
    console.log("Starting note ingestion process...");

    // Check authentication first
    console.log("Checking authentication...");
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the input data from the request
    const { text, category } = await req.json();
    if (!text) {
      return new NextResponse("Missing text in request body", { status: 400 });
    }

    // Sanitize the input text
    const sanitizedText = sanitizeText(text);
    
    if (sanitizedText.length === 0) {
      return new NextResponse("Empty note content after sanitization", { status: 400 });
    }

    if (sanitizedText.length > 10000) {
      return new NextResponse("Note is too long. Please keep notes under 10,000 characters.", { status: 400 });
    }
    
    console.log(`Received note with ${sanitizedText.length} characters`);
    
    // Set category (default to "notes" if not specified)
    const noteCategory = category || "notes";
    
    // Create a unique note ID
    const noteId = `note-${userId}-${Date.now()}`;
    const createdAt = new Date().toISOString();

    // Initialize embeddings model
    console.log("Initializing embeddings model...");
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
      modelName: "embedding-001"
    });

    // Generate embedding for the note
    console.log("Generating embedding for note...");
    const embedding = await embeddings.embedQuery(sanitizedText);

    // Get the Pinecone index
    const index = pinecone.index(process.env.PINECONE_INDEX || "");

    // Create the note title from first line or sentence
    const noteTitle = extractNoteTitle(sanitizedText);

    // Create vector with metadata
    const vector = {
      id: noteId,
      values: embedding,
      metadata: {
        text: sanitizedText,
        userId,
        categories: [noteCategory],
        access: "personal", // Notes are always personal
        type: "note", // Distinguish from documents
        noteId,
        createdAt,
        title: noteTitle,
        contentType: "note"
      },
    };

    // Upsert the vector to Pinecone
    console.log("Storing note in Pinecone...");
    await index.upsert([vector]);

    console.log(`Successfully ingested note: ${noteId}`);
    
    return new NextResponse(JSON.stringify({ 
      success: true,
      message: "Note saved successfully!",
      noteId,
      title: noteTitle
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (_error) {
    console.error("Error in note ingestion:", _error);
    return new NextResponse(JSON.stringify({ 
      error: "Internal server error",
      message: _error instanceof Error ? _error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Extracts a title from the beginning of the note
 */
function extractNoteTitle(text: string): string {
  // Try to find a title from the first line
  const firstLine = text.split('\n')[0].trim();
  
  if (firstLine.length > 0 && firstLine.length <= 80) {
    return firstLine;
  }
  
  // Try the first sentence
  const firstSentence = text.split(/[.!?]/)[0].trim();
  if (firstSentence.length > 0 && firstSentence.length <= 80) {
    return firstSentence;
  }
  
  // If no good title found, use the first 50 characters
  return text.substring(0, 50) + (text.length > 50 ? '...' : '');
} 