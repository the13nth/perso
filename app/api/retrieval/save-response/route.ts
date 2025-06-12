import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Check for required environment variables
    if (!process.env.PINECONE_API_KEY) {
      return NextResponse.json({ message: "Missing PINECONE_API_KEY environment variable" }, { status: 500 });
    }
    
    if (!process.env.PINECONE_INDEX) {
      return NextResponse.json({ message: "Missing PINECONE_INDEX environment variable" }, { status: 500 });
    }
    
    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json({ message: "Missing GOOGLE_API_KEY environment variable" }, { status: 500 });
    }

    const body = await req.json();
    const { query, response, sessionId, userId: bodyUserId, categories = ["conversation"] } = body;

    // Validate required fields
    if (!query || !response || !sessionId) {
      return NextResponse.json({ 
        message: "Query, response, and session ID are required" 
      }, { status: 400 });
    }

    // Validate user ID matches
    if (bodyUserId !== userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Validate categories
    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ 
        message: "At least one category is required" 
      }, { status: 400 });
    }

    // Character limit check for combined text
    const combinedText = `Query: ${query}\n\nResponse: ${response}`;
    
    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX!);

    // Initialize Google Generative AI for embeddings
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    // Generate embeddings for the combined query and response
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(combinedText);
    const embedding = result.embedding;

    if (!embedding.values) {
      throw new Error("Failed to generate embedding");
    }

    // Create a title from the query (first 50 characters)
    const title = query.length > 50 ? `${query.substring(0, 50)}...` : query;
    
    // Generate unique ID for the conversation
    const conversationId = `conversation_${userId}_${sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare metadata
    const metadata = {
      text: combinedText,
      type: "conversation",
      userId: userId,
      sessionId: sessionId,
      query: query,
      response: response,
      timestamp: new Date().toISOString(),
      title: title,
      categories: categories,
      access: "personal",
      contentType: "conversation"
    };

    // Store in Pinecone
    await index.upsert([
      {
        id: conversationId,
        values: embedding.values,
        metadata: metadata,
      },
    ]);

    return NextResponse.json({
      message: "Conversation saved successfully",
      title: title,
      id: conversationId,
      sessionId: sessionId,
    });

  } catch (_error) {
    console.error("Error saving conversation:", _error);
    return NextResponse.json(
      { 
        message: "Failed to save conversation", 
        error: _error instanceof Error ? _error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 