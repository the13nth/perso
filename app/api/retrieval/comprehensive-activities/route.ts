import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone, RecordMetadataValue } from "@pinecone-database/pinecone";
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
    const { text, structuredData, activity, category, userId: bodyUserId } = body;

    // Validate required fields
    if (!text || !activity || !category || !structuredData) {
      return NextResponse.json({ 
        message: "Activity details, activity type, category, and structured data are required" 
      }, { status: 400 });
    }

    // Validate user ID matches
    if (bodyUserId !== userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Character limit check
    if (text.length > 10000) {
      return NextResponse.json({ 
        message: "Activity details too long (max 10,000 characters)" 
      }, { status: 400 });
    }

    // Validate activity category
    const validCategories = ["physical", "work", "study", "routine"];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ 
        message: "Invalid activity category" 
      }, { status: 400 });
    }

    // Validate activity date
    if (structuredData.activityDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(structuredData.activityDate)) {
        return NextResponse.json({ 
          message: "Invalid activity date format. Expected YYYY-MM-DD" 
        }, { status: 400 });
      }
    }

    // Initialize Pinecone
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX!);

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
    const activityName = activity.charAt(0).toUpperCase() + activity.slice(1).replace(/_/g, ' ');
    const activityDateFormatted = structuredData.activityDate ? new Date(structuredData.activityDate).toLocaleDateString() : '';
    const title = `${activityName}${structuredData.duration ? ` - ${structuredData.duration}` : ''}${activityDateFormatted ? ` (${activityDateFormatted})` : ''}`;

    // Generate unique ID for the activity
    const activityId = `comprehensive_activity_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Build comprehensive metadata based on category
    let metadata: Record<string, RecordMetadataValue> = {
      text: text,
      type: "comprehensive_activity",
      activity: activity,
      category: category,
      categories: [category, activity],
      userId: userId,
      timestamp: new Date().toISOString(),
      title: title,
      // Common fields
      activityDate: structuredData.activityDate || "",
      duration: structuredData.duration || "",
      feeling: structuredData.feeling || "",
      productivity: structuredData.productivity || "",
      goalSet: structuredData.goalSet || "",
      goalAchieved: structuredData.goalAchieved || "",
      additionalNotes: structuredData.additionalNotes || "",
      location: structuredData.location || "",
      // Searchable fields
      activityType: activity,
      activityCategory: category,
      hasGoal: structuredData.goalSet ? "yes" : "no",
      hasLocation: structuredData.location ? "yes" : "no",
      hasDate: structuredData.activityDate ? "yes" : "no",
    };

    // Add category-specific metadata
    switch (category) {
      case "physical":
        metadata = {
          ...metadata,
          distance: structuredData.distance || "",
          intensity: structuredData.intensity || "",
          hasDistance: structuredData.distance ? "yes" : "no",
        };
        break;

      case "work":
        metadata = {
          ...metadata,
          projectName: structuredData.projectName || "",
          collaborators: structuredData.collaborators || "",
          workTools: structuredData.workTools || "",
          tasksCompleted: structuredData.tasksCompleted || "",
          focusLevel: structuredData.focusLevel || "",
          hasProject: structuredData.projectName ? "yes" : "no",
          hasCollaborators: structuredData.collaborators ? "yes" : "no",
          hasTools: structuredData.workTools ? "yes" : "no",
        };
        break;

      case "study":
        metadata = {
          ...metadata,
          subject: structuredData.subject || "",
          studyMaterial: structuredData.studyMaterial || "",
          comprehensionLevel: structuredData.comprehensionLevel || "",
          notesCreated: structuredData.notesCreated || "",
          hasSubject: structuredData.subject ? "yes" : "no",
          hasStudyMaterial: structuredData.studyMaterial ? "yes" : "no",
          hasNotes: structuredData.notesCreated ? "yes" : "no",
        };
        break;

      case "routine":
        metadata = {
          ...metadata,
          routineSteps: structuredData.routineSteps || "",
          consistency: structuredData.consistency || "",
          moodBefore: structuredData.moodBefore || "",
          moodAfter: structuredData.moodAfter || "",
          hasRoutineSteps: structuredData.routineSteps ? "yes" : "no",
          hasMoodChange: structuredData.moodBefore !== structuredData.moodAfter ? "yes" : "no",
        };
        break;
    }

    // Store in Pinecone as a single unit (no chunking) with comprehensive metadata
    await index.upsert([
      {
        id: activityId,
        values: embedding.values,
        metadata: metadata,
      },
    ]);

    return NextResponse.json({
      message: "Activity saved successfully",
      title: title,
      activity: activity,
      category: category,
      id: activityId,
      structuredData: structuredData,
    });

  } catch (error) {
    console.error("Error saving comprehensive activity:", error);
    return NextResponse.json(
      { 
        message: "Failed to save activity", 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 