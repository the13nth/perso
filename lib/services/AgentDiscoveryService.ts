import { AgentConfig } from '@/types/agent';
import { AgentCapability, AgentRecommendation } from '@/types/agent';

interface AgentSearchQuery {
  category?: string;
  capabilities?: string[];
  sortBy?: 'relevance' | 'performance' | 'recent_activity';
  minPerformance?: number;
  maxCount?: number;
}

export class AgentDiscoveryService {
  async findAgents(
    query: AgentSearchQuery,
    userId: string
  ): Promise<AgentConfig[]> {
    try {
      console.log('🔍 Finding agents for query:', query);

      // Get all available agents
      const allAgents = await this.getAllAgents(userId);

      // Filter agents based on query criteria
      const filteredAgents = this.filterAgentsByContent(allAgents, query);

      // Sort agents based on query criteria
      const sortedAgents = this.sortAgents(filteredAgents, query);

      // Apply max count limit if specified
      const limitedAgents = query.maxCount ? sortedAgents.slice(0, query.maxCount) : sortedAgents;

      console.log('✅ Found agents:', limitedAgents.length);
      return limitedAgents;
    } catch (_error) {
      console.error('❌ Error finding agents:', _error);
      throw _error;
    }
  }

  private async getAllAgents(userId: string): Promise<AgentConfig[]> {
    try {
      // Get all agents from storage
      const agents = await this.loadAgentsFromStorage(userId);

      // Add universal capabilities to each agent
      return agents.map(agent => ({
        ...agent,
        capabilities: [
          ...(agent.capabilities || []),
          ...this.getUniversalCapabilities()
        ]
      }));
    } catch (_error) {
      console.error('❌ Error loading agents:', _error);
      throw _error;
    }
  }

  private filterAgentsByContent(agents: AgentConfig[], query: AgentSearchQuery): AgentConfig[] {
    return agents.filter(agent => {
      // Category match
      if (query.category && agent.category?.toLowerCase() !== query.category.toLowerCase()) {
        return false;
      }

      // Capabilities match
      if (query.capabilities?.length) {
        const agentCapabilities = agent.capabilities?.map(cap => cap.name.toLowerCase()) || [];
        const requiredCapabilities = query.capabilities.map(cap => cap.toLowerCase());
        if (!requiredCapabilities.every(cap => agentCapabilities.includes(cap))) {
          return false;
        }
      }

      // Performance threshold
      if (query.minPerformance) {
        const performance = agent.metadata?.agent?.performanceMetrics?.taskCompletionRate || 0;
        if (performance < query.minPerformance) {
          return false;
        }
      }

      return true;
    });
  }

  private getUniversalCapabilities(): AgentCapability[] {
    return [
      {
        name: 'semantic_search',
        type: 'processing',
        proficiencyLevel: 80,
        domains: ['search'],
        prerequisites: [],
        description: 'Semantic search capabilities',
        examples: ['Context retrieval', 'Semantic matching'],
        lastUpdated: Date.now(),
        usageCount: 0,
        successRate: 80
      },
      {
        name: 'content_analysis',
        type: 'analysis',
        proficiencyLevel: 75,
        domains: ['analysis'],
        prerequisites: [],
        description: 'Content analysis capabilities',
        examples: ['Data analysis', 'Pattern recognition'],
        lastUpdated: Date.now(),
        usageCount: 0,
        successRate: 75
      }
    ];
  }

  private sortAgents(agents: AgentConfig[], query: AgentSearchQuery): AgentConfig[] {
    return agents.sort((a, b) => {
      if (query.sortBy === 'performance') {
        const aPerformance = a.metadata?.agent?.performanceMetrics?.taskCompletionRate || 0;
        const bPerformance = b.metadata?.agent?.performanceMetrics?.taskCompletionRate || 0;
        return bPerformance - aPerformance;
      }
      if (query.sortBy === 'recent_activity') {
        const aActivity = a.metadata?.updatedAt || 0;
        const bActivity = b.metadata?.updatedAt || 0;
        return bActivity - aActivity;
      }
      // Default to relevance (based on matching criteria)
      return this.calculateRelevanceScore(b, query) - this.calculateRelevanceScore(a, query);
    });
  }

  private calculateRelevanceScore(agent: AgentConfig, query: AgentSearchQuery): number {
    let score = 0;

    // Category match
    if (query.category && agent.category?.toLowerCase() === query.category.toLowerCase()) {
      score += 50;
    }

    // Capabilities match
    if (query.capabilities?.length) {
      const agentCapabilities = agent.capabilities?.map(cap => cap.name.toLowerCase()) || [];
      const requiredCapabilities = query.capabilities.map(cap => cap.toLowerCase());
      const matchingCapabilities = requiredCapabilities.filter(cap => agentCapabilities.includes(cap));
      score += (matchingCapabilities.length / requiredCapabilities.length) * 30;
    }

    // Performance score
    const performance = agent.metadata?.agent?.performanceMetrics?.taskCompletionRate || 0;
    score += performance * 0.2;

    return score;
  }

  private async loadAgentsFromStorage(userId: string): Promise<AgentConfig[]> {
    try {
      // TODO: Implement actual storage logic
      return [];
    } catch (_error) {
      console.error('❌ Error loading agents from storage:', _error);
      throw _error;
    }
  }
} 