import { DynamicTool } from "@langchain/core/tools";
import { Document } from "@langchain/core/documents";
import { getAgentContext, storeAgentContext } from "./context-store";

import type { 
  AgentConfig,
  CapabilityMergeResult,
  MergedCapability,
  SuperAgentConfig,

} from "./types";

export async function mergeAgentCapabilities(
  parentAgents: AgentConfig[]
): Promise<CapabilityMergeResult> {
  try {
    console.log('[DEBUG] Starting capability merge for agents:', 
      parentAgents.map(a => a.name));

    // Create default capabilities based on metadata and description
    const defaultCapabilities: MergedCapability[] = [];
    
    parentAgents.forEach(agent => {
      if (agent.metadata?.agent) {
        // Add capabilities based on triggers
        agent.metadata.agent.triggers.forEach(trigger => {
          const [name, context] = trigger.split(';').map(s => s.trim());
          defaultCapabilities.push({
            name: `${name} Management`,
            description: `Handle ${name.toLowerCase()} related tasks in the context of ${context}`,
            tools: [],
            sourceAgents: [agent.name],
            priority: 2
          });
        });

        // Add capability based on use cases
        defaultCapabilities.push({
          name: 'Information Assistant',
          description: agent.metadata.agent.useCases,
          tools: [],
          sourceAgents: [agent.name],
          priority: 2
        });

        // Add capability based on category
        defaultCapabilities.push({
          name: agent.metadata?.primaryCategory || 'General',
          description: `Provide ${agent.metadata?.primaryCategory?.toLowerCase() || 'general'} related assistance`,
          tools: [],
          sourceAgents: [agent.name],
          priority: 1
        });

        // Add context-aware capability
        if (agent.metadata.agent.selectedContextIds.length > 0) {
          defaultCapabilities.push({
            name: 'Context Integration',
            description: `Integrate and analyze information from contexts: ${agent.metadata.agent.selectedContextIds.join(', ')}`,
            tools: [],
            sourceAgents: [agent.name],
            priority: 2
          });
        }

        // Add core capabilities
        defaultCapabilities.push({
          name: 'Task Management',
          description: 'Manage and track tasks, deadlines, and work items',
          tools: [],
          sourceAgents: [agent.name],
          priority: 2
        });

        defaultCapabilities.push({
          name: 'Communication',
          description: 'Handle communication and information exchange between users and systems',
          tools: [],
          sourceAgents: [agent.name],
          priority: 1
        });
      }
    });

    // Process the capabilities
    console.log('[DEBUG] Processing capabilities');
    const mergedCapabilities = defaultCapabilities;

    // Deduplicate and combine similar capabilities
    console.log('[DEBUG] Deduplicating capabilities');
    const uniqueCapabilities = new Map<string, MergedCapability>();
    mergedCapabilities.forEach(cap => {
      const existing = uniqueCapabilities.get(cap.name);
      if (existing) {
        existing.sourceAgents = Array.from(new Set([...(existing.sourceAgents || []), ...(cap.sourceAgents || [])]));
        existing.tools = Array.from(new Set([...(existing.tools || []), ...(cap.tools || [])]));
        existing.priority = Math.max(existing.priority, cap.priority);
        existing.description = `${existing.description}\n\nAdditional context from ${cap.sourceAgents.join(", ")}:\n${cap.description}`;
      } else {
        uniqueCapabilities.set(cap.name, cap);
      }
    });

    const finalCapabilities = Array.from(uniqueCapabilities.values());
    console.log('[DEBUG] Final merged capabilities:', finalCapabilities);

    return {
      success: true,
      mergedCapabilities: finalCapabilities
    };
  } catch (_error) {
    console.error('[ERROR] Failed to merge capabilities:', _error);
    return {
      success: false,
      mergedCapabilities: [],
      error: _error instanceof Error ? _error.message : 'Unknown error occurred'
    };
  }
}

export async function createSuperAgent(
  parentAgents: AgentConfig[]
): Promise<SuperAgentConfig> {
  try {
    console.log('[DEBUG] Creating super agent for parents:', 
      parentAgents.map(a => a.name));

    const mergeResult = await mergeAgentCapabilities(parentAgents);
    
    if (!mergeResult.success || !mergeResult.mergedCapabilities.length) {
      console.error('[ERROR] Failed to merge capabilities or no capabilities found');
      // Create default capabilities if merge failed
      mergeResult.mergedCapabilities = parentAgents.flatMap(agent => {
        const capabilities = [];
        if (agent.metadata?.agent) {
          capabilities.push({
            name: 'Base Assistant',
            description: agent.metadata.agent.useCases || agent.description,
            tools: [],
            sourceAgents: [agent.name],
            priority: 1
          });
          
          if (agent.metadata.primaryCategory) {
            capabilities.push({
              name: agent.metadata.primaryCategory,
              description: `Provide ${agent.metadata.primaryCategory.toLowerCase()} related assistance`,
              tools: [],
              sourceAgents: [agent.name],
              priority: 1
            });
          }
        }
        return capabilities;
      });
    }

    const agentId = `super-${Date.now()}`;
    const name = `Super Agent (${parentAgents.map(a => a.name).join(' + ')})`;
    const description = `A super agent combining capabilities of ${parentAgents.map(a => a.name).join(' and ')}`;

    // Create a super agent with merged capabilities
    const superAgent: SuperAgentConfig = {
      agentId,
      name,
      description,
      capabilities: mergeResult.mergedCapabilities,
      parentAgents: parentAgents.map(a => a.agentId),
      mergedCapabilities: mergeResult.mergedCapabilities,
      metadata: {
        type: 'swarm_result' as const,
        contentId: agentId,
        userId: parentAgents[0]?.metadata?.userId || '',
        name,
        description,
        category: parentAgents[0]?.metadata?.primaryCategory || 'Assistant',
        useCases: parentAgents[0]?.metadata?.agent?.useCases || '',
        isPublic: false,
        ownerId: parentAgents[0]?.metadata?.userId || '',
        selectedContextIds: parentAgents.flatMap(a => a.metadata?.agent?.selectedContextIds || []),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agent: {
          type: 'agent_config',
          capabilities: mergeResult.mergedCapabilities.map(cap => cap.name),
          tools: [],
          useCases: parentAgents[0]?.metadata?.agent?.useCases || '',
          triggers: parentAgents.flatMap(a => a.metadata?.agent?.triggers || []),
          selectedContextIds: parentAgents.flatMap(a => a.metadata?.agent?.selectedContextIds || []),
          isPublic: false,
          ownerId: parentAgents[0]?.metadata?.userId || '',
          dataAccess: [],
          performanceMetrics: {
            taskCompletionRate: 0,
            averageResponseTime: 0,
            userSatisfactionScore: 0,
            totalTasksCompleted: 0
          }
        }
      }
    };

    console.log('[DEBUG] Created super agent:', {
      name: superAgent.name,
      capabilities: superAgent.mergedCapabilities.map(c => c.name)
    });

    return superAgent;
  } catch (_error) {
    console.error('[ERROR] Failed to create super agent:', _error);
    throw new Error('Failed to create super agent');
  }
}

export interface Capability {
  name: string;
  description: string;
  tools: DynamicTool[];
  context?: string;
}

export async function mergeCapabilities(
  agentId: string,
  capabilities: Capability[]
): Promise<{
  tools: DynamicTool[];
  context: Document[];
}> {
  try {
    // Store context for each capability
    const contexts = capabilities
      .filter(cap => cap.context)
      .map(cap => ({
        content: cap.context!,
        title: cap.name,
        source: 'capability'
      }));

    if (contexts.length > 0) {
      await storeAgentContext(agentId, contexts);
    }

    // Get all context documents
    const contextDocs = await getAgentContext(agentId);
    
    // Convert to LangChain documents
    const documents = contextDocs.map(ctx => new Document({
      pageContent: ctx.content,
      metadata: {
        source: ctx.source,
        title: ctx.title,
        score: ctx.score
      }
    }));

    // Merge tools from all capabilities
    const tools = capabilities.reduce<DynamicTool[]>((acc, cap) => {
      return [...acc, ...cap.tools];
    }, []);

    return {
      tools,
      context: documents
    };
  } catch (_error) {
    console.error('[ERROR] Failed to merge capabilities:', _error);
    throw new Error('Failed to merge capabilities');
  }
} 