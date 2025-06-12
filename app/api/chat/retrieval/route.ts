// Remove edge runtime for now since we're using Node.js features
// export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SwarmRetrievalService } from '@/app/lib/services/SwarmRetrievalService';

const retrievalService = new SwarmRetrievalService();

export async function POST(req: NextRequest) {
  try {
    // Get user session
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const { messages, contextType } = await req.json();
    
    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Invalid message format" },
        { status: 400 }
      );
    }

    // Process the retrieval request using swarm
    const result = await retrievalService.processRetrievalRequest(
      lastUserMessage.content,
      userId,
      contextType
    );

    // Extract the text content from the result
    const textContent = result.text;

    // Format the response to match the expected format for the useChat hook
    return NextResponse.json({
      id: result.contentId,
      role: "assistant",
      content: textContent,
      createdAt: new Date(result.createdAt).getTime(),
      formattedContent: [
        {
          type: "text",
          content: textContent
        }
      ]
    });
  } catch (error) {
    console.error('Error in retrieval chat:', error);
    return NextResponse.json(
      { error: 'Failed to process retrieval request' },
      { status: 500 }
    );
  }
}
