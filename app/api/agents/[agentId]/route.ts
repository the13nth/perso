import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAgentConfig } from '@/lib/pinecone';

export async function GET(
  _request: Request,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { agentId } = await context.params;
    // Get agent configuration
    const agent = await getAgentConfig(agentId);

    // Check if user has access to this agent
    if (!agent.isPublic && agent.ownerId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to access this agent" },
        { status: 403 }
      );
    }

    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch agent" },
      { status: 500 }
    );
  }
} 