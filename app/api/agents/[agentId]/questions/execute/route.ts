import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { AgentRAGService } from '@/app/lib/services/AgentRAGService';
import { BaseRAGService } from '@/app/lib/services/BaseRAGService';
import { v4 as uuidv4 } from 'uuid';

const ragService: BaseRAGService = new AgentRAGService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Verify authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agentId } = await params;
    const body = await req.json();

    if (!body.question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Generate response using the RAG service
    const response = await ragService.generateResponse(agentId, [{
      id: uuidv4(),
      role: 'user',
      content: body.question
    }]);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error executing agent question:', error);
    return NextResponse.json({ 
      error: 'Failed to execute agent question',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 