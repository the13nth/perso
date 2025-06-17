import { NextRequest } from 'next/server';
import { AgentRAGService } from '@/app/lib/services/AgentRAGService';
import { auth } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';

const ragService = new AgentRAGService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { query } = await req.json();
    const { agentId } = await params;
    
    const response = await ragService.generateResponse(
      agentId,
      [{
        id: uuidv4(),
        role: 'user',
        content: query
      }]
    );

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in chat route:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 