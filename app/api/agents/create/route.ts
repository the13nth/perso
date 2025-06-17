import { NextResponse } from 'next/server';
import { AgentFactory } from '@/lib/agents/AgentFactory';
import { z } from 'zod';

// Validation schema for the request body
const createAgentSchema = z.object({
  userId: z.string(),
  contextOptions: z.object({
    categories: z.array(z.string()).optional(),
    includeProjectContext: z.boolean().optional(),
    includeUserHistory: z.boolean().optional(),
    maxContextSize: z.number().optional(),
    minBridgeStrength: z.number().optional()
  }).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = createAgentSchema.parse(body);
    
    // Generate a unique agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create agent factory
    const factory = new AgentFactory();
    
    // Create agent with context
    const agent = await factory.createAgent({
      agentId,
      userId: validatedData.userId,
      contextOptions: validatedData.contextOptions ? {
        ...validatedData.contextOptions,
        userId: validatedData.userId
      } : undefined
    });
    
    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        userId: agent.userId,
        context: {
          vectors: agent.context.vectors,
          scores: agent.context.scores,
          bridges: agent.context.bridges
        }
      }
    });
    
  } catch (error) {
    console.error('Error creating agent:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
} 