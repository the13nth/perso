import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';

// Function to save insight to Pinecone
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Extract insight data from request
    const { 
      category,
      summary,
      trends = [],
      keyTopics = [],
      recommendations = [],
      connections = [],
      insightType = "full"
    } = await req.json();
    
    if (!category || !summary) {
      return NextResponse.json(
        { error: "Missing required fields (category, summary)" },
        { status: 400 }
      );
    }

    // Create a combined text representation of the insight
    const insightText = `
      INSIGHT SUMMARY (${insightType} insight for ${category}): ${summary}
      
      KEY TRENDS:
      ${trends.map((trend: string, i: number) => `${i+1}. ${trend}`).join('\n')}
      
      KEY TOPICS:
      ${keyTopics.map((topic: string, i: number) => `${i+1}. ${topic}`).join('\n')}
      
      RECOMMENDATIONS:
      ${recommendations.map((rec: string, i: number) => `${i+1}. ${rec}`).join('\n')}
      
      CONNECTIONS:
      ${connections.map((conn: string, i: number) => `${i+1}. ${conn}`).join('\n')}
    `;

    const apiKey = process.env.PINECONE_API_KEY;
    const host = process.env.PINECONE_HOST;

    if (!apiKey || !host) {
      throw new Error("Missing Pinecone configuration");
    }
    
    // Generate embedding for the insight text
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY || "",
    });
    
    const embeddingResult = await embeddings.embedQuery(insightText);
    
    // Prepare metadata with descriptive categories
    const insightCategoryName = `${category} insights`;
    const metadata = {
      text: insightText,
      categories: [insightCategoryName, "insight"],
      insightType: insightType,
      originalCategory: category,
      userId,
      timestamp: new Date().toISOString(),
      summary,
    };
    
    // Remove any protocol prefix from the host if it exists
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // Create unique ID for the insight with more descriptive format
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const insightId = `insight-${category}-${insightType}-${timestamp}-${uuidv4().slice(0, 8)}`;
    
    // Save to Pinecone
    const upsertResponse = await fetch(
      `https://${cleanHost}/vectors/upsert`,
      {
        method: 'POST',
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: [{
            id: insightId,
            values: embeddingResult,
            metadata
          }]
        }),
      }
    );

    if (!upsertResponse.ok) {
      const errorData = await upsertResponse.text();
      console.error("Pinecone upsert failed:", errorData);
      return NextResponse.json(
        { error: "Failed to save insight to Pinecone" },
        { status: upsertResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      insightId,
      category: insightCategoryName,
      insightType: insightType,
      message: `Insight saved successfully under "${insightCategoryName}" category`
    });
    
  } catch (_error) {
    console.error("Error saving insight:", _error);
    return NextResponse.json(
      { error: "Failed to save insight" },
      { status: 500 }
    );
  }
} 