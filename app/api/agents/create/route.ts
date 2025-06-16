import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { storeAgentWithContext } from '@/lib/pinecone';
import { v4 as uuidv4 } from 'uuid';

// Types
interface CreateAgentRequest {
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string;
  isPublic: boolean;
  selectedCategories: string[];
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: CreateAgentRequest = await req.json();

    // Generate a unique ID for the agent (without prefix, it will be added in storeAgentWithContext)
    const agentId = uuidv4();

    // Store agent with its embedding
    const agent = await storeAgentWithContext(
      agentId,
      {
        name: body.name,
        description: body.description,
        category: body.category,
        useCases: body.useCases,
        triggers: body.triggers?.split(',').map(t => t.trim()),
        isPublic: body.isPublic
      },
      [], // No context documents needed
      body.selectedCategories || [],
      userId
    );

    return NextResponse.json({ success: true, agentId: agent.agentId });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: "Failed to create agent" },
      { status: 500 }
    );
  }
} 