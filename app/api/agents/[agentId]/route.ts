import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getAgentConfig, updateAgentConfig } from '@/lib/pinecone';

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

export async function PUT(
  request: Request,
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
    const body = await request.json();

    // Get current agent configuration to verify ownership
    const currentAgent = await getAgentConfig(agentId);
    if (currentAgent.ownerId !== userId) {
      return NextResponse.json(
        { error: "Not authorized to update this agent" },
        { status: 403 }
      );
    }

    // Update agent configuration
    const updatedAgent = await updateAgentConfig(agentId, {
      name: body.name,
      description: body.description,
      category: body.category,
      useCases: body.useCases,
      triggers: Array.isArray(body.triggers) 
        ? body.triggers 
        : body.triggers?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      isPublic: body.isPublic,
      selectedContextIds: body.selectedContextIds || currentAgent.selectedContextIds,
      updatedAt: Date.now()
    });

    return NextResponse.json(updatedAgent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update agent" },
      { status: 500 }
    );
  }
} 