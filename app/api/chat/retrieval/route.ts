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

    // Extract the text content from the result
    const textContent = result.text;

    // Format the response to match the expected format for the useChat hook
    return new Response(JSON.stringify({
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
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (_error) {
    console.error('Error in retrieval route:', _error);
    
    // Format error response to match the expected format for the useChat hook
    const errorMessage = _error instanceof Error ? _error.message : "An unknown error occurred";
    
    return new Response(JSON.stringify({
      id: `error-${Date.now()}`,
      role: "assistant",
      content: `Error: ${errorMessage}. Please try again or refine your query.`,
      createdAt: Date.now(),
      formattedContent: [
        {
          type: "error",
          content: `Error: ${errorMessage}. Please try again or refine your query.`
        }
      ]
    }), {
      status: 200, // Return 200 so the client can display the error message
      headers: { "Content-Type": "application/json" }
    });
  }
}
