import { NextResponse } from 'next/server';
import { AgentRAGService } from '../../../../lib/services/AgentRAGService';

const ragService = new AgentRAGService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json(
        { error: "Agent ID is required and must be a string" },
        { status: 400 }
      );
    }

    // Parse the request body
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Generate response using the RAG service
    const response = await ragService.generateResponse(agentId, messages);

    return NextResponse.json(response);
  } catch (error: Error | unknown) {
    console.error('Error executing agent:', error);
    
    let errorMessage = 'Failed to execute agent';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message?.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 401;
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Agent not found';
        statusCode = 404;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : error },
      { status: statusCode }
    );
  }
} 