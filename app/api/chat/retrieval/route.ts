// Remove edge runtime for now since we're using Node.js features
// export const runtime = 'edge';

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SwarmRetrievalService } from '@/app/lib/services/SwarmRetrievalService';

const retrievalService = new SwarmRetrievalService();

export async function POST(req: NextRequest) {
  try {
    // Get user session
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { messages, contextType } = await req.json();
    
    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return new Response(JSON.stringify({ error: "Invalid message format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Process the retrieval request using swarm
    const result = await retrievalService.processRetrievalRequest(
      lastUserMessage.content,
      userId,
      contextType
    );

    return new Response(JSON.stringify({
      success: true,
      result
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('Error in retrieval route:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
