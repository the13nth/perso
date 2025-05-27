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
    return NextResponse.json({ agents });
  } catch (error) {
    console.error('Error listing user agents:', error);
    return NextResponse.json(
      { error: 'Failed to list user agents' },
      { status: 500 }
    );
  }
} 