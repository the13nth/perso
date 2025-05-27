import {  NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Types
interface CreateAgentRequest {
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
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
    
    return NextResponse.json({
      success: true,
      data: {
        agentId: "test-agent",
        name: body.name,
        description: body.description,
        category: body.category,
        isPublic: body.isPublic
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
} 