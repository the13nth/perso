import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { agentRunner } from '@/lib/services/agent-runner';

// Get the base URL from environment or default to localhost in development
const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { agentId } = params;
    const body = await req.json();

    // Get auth token
    const authToken = await session.getToken();

    // Execute the agent's task using absolute URL
    const response = await fetch(`${BASE_URL}/api/agents/${agentId}/questions/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        question: "What tasks can you help me with?",
        context: body.context
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Agent execution failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();
    return Response.json(result);

  } catch (error) {
    console.error('Error executing agent:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to execute agent',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
} 