import { NextRequest } from 'next/server';
import { AgentSupervisor } from '@/lib/agents/langchain/supervisor';
import { getAgentConfig } from '@/lib/pinecone';
import { AgentMetadata } from '@/app/lib/agents/langchain/types';
import { convertPineconeAgentToConfig } from '@/app/lib/agents/langchain/config';

// Keep track of active supervisors
const supervisors = new Map<string, AgentSupervisor>();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  try {
    const { agentId } = await context.params;
    const { messages, show_intermediate_steps = false } = await request.json();

    // Get the current message
    const currentMessage = messages[messages.length - 1];
    if (!currentMessage || currentMessage.role !== 'user') {
      return new Response('Invalid message format', { status: 400 });
    }

    // Get or create supervisor
    let supervisor = supervisors.get(agentId);
    if (!supervisor) {
      const pineconeAgent = await getAgentConfig(agentId);
      if (!pineconeAgent) {
        return new Response('Agent not found', { status: 404 });
      }

      // Convert ISO string dates to timestamps
      const now = Date.now();

      // Create agent metadata
      const agentMetadata: AgentMetadata = {
        contentId: pineconeAgent.agentId,
        userId: pineconeAgent.ownerId,
        name: pineconeAgent.name,
        description: pineconeAgent.description,
        category: pineconeAgent.category,
        useCases: pineconeAgent.useCases || '',
        selectedContextIds: pineconeAgent.selectedContextIds || [],
        isPublic: pineconeAgent.isPublic || false,
        ownerId: pineconeAgent.ownerId,
        type: 'agent_config',
        createdAt: now,
        updatedAt: now,
        primaryCategory: pineconeAgent.category,
        agent: {
          isPublic: pineconeAgent.isPublic || false,
          type: 'agent_config',
          capabilities: [],
          tools: [],
          useCases: pineconeAgent.useCases || '',
          triggers: [],
          ownerId: pineconeAgent.ownerId,
          dataAccess: [],
          selectedContextIds: pineconeAgent.selectedContextIds || [],
          performanceMetrics: {
            taskCompletionRate: 0,
            averageResponseTime: 0,
            userSatisfactionScore: 0,
            totalTasksCompleted: 0
          }
        }
      };

      // Convert to agent config
      const agentConfig = convertPineconeAgentToConfig(agentMetadata);

      // Create supervisor with new metadata format
      supervisor = new AgentSupervisor({
        agentId,
        metadata: agentMetadata,
        capabilities: agentConfig.capabilities,
        tools: []
      });
      supervisors.set(agentId, supervisor);
    }

    // Process message
    const response = await supervisor.processMessage(currentMessage.content, show_intermediate_steps);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return new Response('Internal server error', { status: 500 });
  }
} 