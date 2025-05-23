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

    const body = await req.json();
    const { text, structuredData, activity, userId: bodyUserId } = body;

    // Validate required fields
    if (!text || !activity || !structuredData) {
      return NextResponse.json({ message: "Activity details, activity type, and structured data are required" }, { status: 400 });
    }

    // Validate user ID matches
    if (bodyUserId !== userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Character limit check
    if (text.length > 10000) {
      return NextResponse.json({ message: "Activity details too long (max 10,000 characters)" }, { status: 400 });
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index("langchain-js");

    // Initialize Google Generative AI for embeddings
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    // Generate embeddings for the activity
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding.values) {
      throw new Error("Failed to generate embedding");
    }

    // Create a title from the activity and duration
    const activityName = structuredData.activity.charAt(0).toUpperCase() + structuredData.activity.slice(1);
    const title = `${activityName}${structuredData.duration ? ` - ${structuredData.duration}` : ''}${structuredData.distance ? ` (${structuredData.distance})` : ''}`;

    // Generate unique ID for the activity
    const activityId = `activity_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store in Pinecone as a single unit (no chunking) with structured metadata
    await index.upsert([
      {
        id: activityId,
        values: embedding.values,
        metadata: {
          text: text,
          type: "activity",
          activity: activity,
          userId: userId,
          timestamp: new Date().toISOString(),
          title: title,
          // Structured activity data
          duration: structuredData.duration || "",
          distance: structuredData.distance || "",
          intensity: structuredData.intensity || "",
          feeling: structuredData.feeling || "",
          goalSet: structuredData.goalSet || "",
          goalAchieved: structuredData.goalAchieved || "",
          additionalNotes: structuredData.additionalNotes || "",
          // Additional searchable fields
          activityType: structuredData.activity,
          hasGoal: structuredData.goalSet ? "yes" : "no",
          hasDistance: structuredData.distance ? "yes" : "no",
        },
      },
    ]);

    return NextResponse.json({
      message: "Activity saved successfully",
      title: title,
      activity: activity,
      id: activityId,
      structuredData: structuredData,
    });

  } catch (error) {
    console.error("Error saving activity:", error);
    return NextResponse.json(
      { 
        message: "Failed to save activity", 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 