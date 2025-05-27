import { NextResponse } from 'next/server';
import { listPublicAgents } from '@/lib/pinecone';

export async function GET() {
  try {
    const agents = await listPublicAgents();
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error listing public agents:', error);
    return NextResponse.json(
      { error: 'Failed to list public agents' },
      { status: 500 }
    );
  }
} 