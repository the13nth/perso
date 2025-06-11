import { NextResponse } from 'next/server';
import { listUserAgents } from '@/lib/pinecone';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    // Get user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to view your agents" },
        { status: 401 }
      );
    }
    
    const agents = await listUserAgents(userId);
    
    // Filter out any invalid agents and ensure proper structure
    const validAgents = agents.filter(agent => 
      agent && 
      agent.agentId && 
      agent.name && 
      agent.description
    );

    return NextResponse.json({ agents: validAgents });
  } catch (_error) {
    console.error('Error listing user agents:', _error);
    return NextResponse.json(
      { error: 'Failed to list user agents', agents: [] },
      { status: 500 }
    );
  }
} 