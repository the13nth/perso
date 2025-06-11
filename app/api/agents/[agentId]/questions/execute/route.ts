import { NextRequest } from 'next/server';
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
    const session = await auth();
    if (!session?.userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Await the params promise
    const { agentId } = await params;
    const body = await req.json();

    if (!body.question) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400 }
      );
    }

    // Generate response using the RAG service
    const response = await ragService.generateResponse(agentId, [{
      id: uuidv4(),
      role: 'user',
      content: body.question
    }]);

    return Response.json(response);

  } catch (error) {
    console.error('Error executing agent question:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to execute agent question',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500 }
    );
  }
} 