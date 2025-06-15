import { AgentSupervisor } from '@/lib/agents/langchain/supervisor';
import { getAgentConfig } from '@/lib/pinecone';
import { EmailAgentRAGService } from '@/app/lib/services/EmailAgentRAGService';
import { convertPineconeAgentToConfig } from '@/app/lib/agents/langchain/config';
import { AgentMetadata } from '@/app/lib/agents/langchain/types';

// Keep track of active supervisors
const supervisors = new Map<string, AgentSupervisor>();

// Initialize email agent service
const emailAgentService = new EmailAgentRAGService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  try {
    const { agentId } = await params;
    
    if (!agentId || typeof agentId !== 'string') {
      return Response.json(
        { error: "Agent ID is required and must be a string" },
        { status: 400 }
      );
    }

    const { messages, show_intermediate_steps = false } = await request.json();
    const currentMessage = messages[messages.length - 1];

    // Get agent configuration from Pinecone
    const pineconeAgent = await getAgentConfig(agentId);
    if (!pineconeAgent) {
      return Response.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check if this is an email agent
    if (pineconeAgent.type === 'email') {
      console.log(`[CHAT] Using EmailAgentRAGService for agent ${agentId}`);
      const response = await emailAgentService.generateResponse(agentId, messages);
      return Response.json(response);
    }

    // Convert ISO string dates to timestamps
    const now = Date.now();

    // Create agent metadata
    const agentMetadata: AgentMetadata = {
      contentId: agentId,
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

    // Convert to agent config and get capabilities
    const agentConfig = convertPineconeAgentToConfig(agentMetadata);

    // Create agent supervisor with capabilities from config
    const supervisor = new AgentSupervisor({
      agentId,
      metadata: agentMetadata,
      capabilities: agentConfig.capabilities,
      tools: agentMetadata.agent?.tools || []
    });
    
    const response = await supervisor.processMessage(currentMessage.content, show_intermediate_steps);

    return Response.json(response);
  } catch (error) {
    console.error('Error processing message:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 