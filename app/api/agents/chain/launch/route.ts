import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { agentRunner } from '@/lib/services/agent-runner';
import { AgentMetadata } from '@/lib/pinecone';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.userId) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { agents } = body as { agents: AgentMetadata[] };

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No agents provided' }),
        { status: 400 }
      );
    }

    // Launch the agent chain
    const result = await agentRunner.launchAgentChain(agents);
    return Response.json(result);

  } catch (error) {
    console.error('Error launching agent chain:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to launch agent chain' }),
      { status: 500 }
    );
  }
} 