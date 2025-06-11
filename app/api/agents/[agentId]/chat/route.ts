import { NextRequest } from 'next/server';
import { AgentSupervisor } from '@/lib/agents/langchain/supervisor';
import { getAgentConfig } from '@/lib/pinecone';
import { AgentMetadata } from '@/app/lib/agents/langchain/types';
import { convertPineconeAgentToConfig } from '@/app/lib/agents/langchain/config';
import { EmailAgentRAGService } from '@/app/lib/services/EmailAgentRAGService';

// Keep track of active supervisors
const supervisors = new Map<string, AgentSupervisor>();

// Initialize email agent service
const emailAgentService = new EmailAgentRAGService();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  try {
    const { agentId } = await context.params;
    const { messages, show_intermediate_steps = false } = await request.json();
    const currentMessage = messages[messages.length - 1];

    // Get agent configuration
    const pineconeAgent = await getAgentConfig(agentId);
    if (!pineconeAgent) {
      return new Response('Agent not found', { status: 404 });
    }

    // Check if this is an email agent
    if (pineconeAgent.selectedContextIds?.includes('Emails')) {
      console.log(`[CHAT] Using EmailAgentRAGService for agent ${agentId}`);
      const response = await emailAgentService.generateResponse(agentId, messages);
      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // For non-email agents, use the standard supervisor
    let supervisor = supervisors.get(agentId);

    if (!supervisor) {
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

    // Process message using standard supervisor
    const response = await supervisor.processMessage(currentMessage.content, show_intermediate_steps);

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (_error) {
    console.error('Error processing message:', _error);
    return new Response('Internal server error', { status: 500 });
  }
} 