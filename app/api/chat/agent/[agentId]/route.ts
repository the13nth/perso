import { NextRequest, NextResponse } from 'next/server';

export const runtime = "edge";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Extract the agentId from the URL parameters
    const { agentId } = await params;
    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Parse the request body
    const { messages, sessionId } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    // Make request to agent execute endpoint
    const response = await fetch(`${request.nextUrl.origin}/api/agents/${agentId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        sessionId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get response from agent");
    }

    const data = await response.json();

    // Format the response as a message array
    const responseMessages = [
      ...messages,
      {
        id: messages.length.toString(),
        role: "assistant",
        content: data.response,
      },
    ];

    // Return the response
    return NextResponse.json({
      messages: responseMessages,
      agentId,
    });
  } catch (error: Error | unknown) {
    console.error('Error in chat route:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request', 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 