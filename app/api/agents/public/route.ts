import { NextResponse } from 'next/server';
import { listPublicAgents } from '@/lib/pinecone';

export async function GET() {
  try {
    const agents = await listPublicAgents();
    
    // Filter out any invalid agents and ensure proper structure
    const validAgents = agents.filter(agent => 
      agent && 
      agent.agentId && 
      agent.name && 
      agent.description
    );

    return NextResponse.json({ agents: validAgents });
  } catch (error) {
    console.error('Error listing public agents:', error);
    return NextResponse.json(
      { error: 'Failed to list public agents', agents: [] },
      { status: 500 }
    );
  }
} 