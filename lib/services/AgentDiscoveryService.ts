import { 
  SwarmCapableAgent, 
  AgentSearchQuery, 
  AgentRecommendation,
  AgentCapability,
  SwarmRole
} from '@/types/swarm';
import { listUserAgents, listPublicAgents } from '@/lib/pinecone';

interface AgentSpecialization {
  domain: string;
  level: 'novice' | 'intermediate' | 'expert' | 'master';
  experience: number;
  lastUsed: number;
}

export class AgentDiscoveryService {
  
  /**
   * Find candidate agents based on search criteria
   */
  async findCandidateAgents(
    query: AgentSearchQuery, 
    userId: string
  ): Promise<SwarmCapableAgent[]> {
    console.log('🔍 Finding candidate agents:', query);

    try {
      // Get all available agents (user's own + public)
      const [userAgents, publicAgents] = await Promise.all([
        listUserAgents(userId),
        listPublicAgents()
      ]);

      // Convert to SwarmCapableAgent format
      const allAgents = [...userAgents, ...publicAgents]
        .filter(agent => !query.excludeAgents?.includes(agent.agentId))
        .map(agent => this.convertToSwarmCapableAgent(agent));

      // Filter agents based on query criteria and content
      let filteredAgents = this.filterAgentsByContent(allAgents, query);

      // Sort agents based on query criteria
      filteredAgents = this.sortAgents(filteredAgents, query);

      // Limit results
      const maxResults = query.maxResults || 10;
      const result = filteredAgents.slice(0, maxResults);

      console.log(`✅ Found ${result.length} candidate agents`);
      return result;
    } catch (_error) {
      console.error('❌ Error finding candidate agents:', _error);
      return [];
    }
  }

  /**
   * Filter agents based on query content and criteria
   */
  private filterAgentsByContent(agents: SwarmCapableAgent[], query: AgentSearchQuery): SwarmCapableAgent[] {
    console.log('Filtering agents with query:', query);
    return agents.filter(agent => {
      // Check if agent matches required capabilities
      if (query.capabilities && query.capabilities.length > 0) {
        const agentCapabilities = this.generateCapabilitiesFromAgent(agent);
        console.log('Agent capabilities for', agent.name, ':', agentCapabilities.map(c => c.name));
        console.log('Required capabilities:', query.capabilities);
        
        // Check if agent has all required capabilities
        const hasAllCapabilities = query.capabilities.every(requiredCap => 
          agentCapabilities.some(agentCap => 
            agentCap.name.toLowerCase() === requiredCap.toLowerCase()
          )
        );
        
        if (!hasAllCapabilities) {
          console.log('Agent', agent.name, 'missing some required capabilities');
          return false;
        }
      }

      // Check if agent's description or use cases match the query content
      if (query.query) {
        const queryWords = query.query.toLowerCase().split(/\s+/);
        
        // Check each source for matches
        const descriptionMatches = queryWords.some(word => 
          agent.description?.toLowerCase().includes(word)
        );
        console.log('Description matches for', agent.name, ':', descriptionMatches);

        const useCasesMatches = queryWords.some(word => 
          agent.useCases?.toLowerCase().includes(word)
        );
        console.log('Use cases matches for', agent.name, ':', useCasesMatches);

        const contextMatches = queryWords.some(word => 
          agent.selectedContextIds?.some(ctx => ctx.toLowerCase().includes(word))
        );
        console.log('Context matches for', agent.name, ':', contextMatches);

        const nameMatches = queryWords.some(word => 
          agent.name?.toLowerCase().includes(word)
        );
        console.log('Name matches for', agent.name, ':', nameMatches);

        const matches = descriptionMatches || useCasesMatches || contextMatches || nameMatches;
        if (!matches) {
          console.log('Agent', agent.name, 'does not match any query words');
          return false;
        }
        console.log('Agent', agent.name, 'matches query content');
      }

      console.log('Agent', agent.name, 'passed all filters');
      return true;
    });
  }

  /**
   * Generate capabilities based on agent metadata
   */
  private generateCapabilitiesFromAgent(agent: SwarmCapableAgent): AgentCapability[] {
    const capabilities: AgentCapability[] = [];

    // Add dynamic capabilities based on agent's contexts
    if (agent.selectedContextIds) {
      for (const contextId of agent.selectedContextIds) {
        // Generate context-specific capabilities
        capabilities.push(this.createContextCapability(contextId));
      }
    }

    // Add universal capabilities that all agents should have
    capabilities.push(...this.getUniversalCapabilities());

    // Add specialized capabilities based on agent's metadata
    if (agent.specializations) {
      for (const spec of agent.specializations) {
        capabilities.push(...this.createSpecializationCapabilities(spec));
      }
    }

    return capabilities;
  }

  private createContextCapability(contextId: string): AgentCapability {
    return {
      name: `${contextId}_processing`,
      type: 'processing',
      proficiencyLevel: 80,
      domains: [contextId],
      prerequisites: [],
      description: `Processing capabilities for ${contextId}`,
      examples: [`${contextId} analysis`],
      lastUpdated: Date.now(),
      usageCount: 0,
      successRate: 80
    };
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

  private createSpecializationCapabilities(spec: AgentSpecialization): AgentCapability[] {
    const proficiencyMap = {
      novice: 60,
      intermediate: 75,
      expert: 90,
      master: 95
    };

    return [{
      name: `${spec.domain}_expertise`,
      type: 'specialized',
      proficiencyLevel: proficiencyMap[spec.level],
      domains: [spec.domain],
      prerequisites: [],
      description: `Expert capabilities in ${spec.domain}`,
      examples: [`${spec.domain} analysis`, `${spec.domain} processing`],
      lastUpdated: spec.lastUsed,
      usageCount: Math.floor(spec.experience / 10),
      successRate: 70 + (spec.experience / 4)
    }];
  }

  /**
   * Get agent recommendations for specific task requirements
   */
  async getAgentRecommendations(
    requirements: string[],
    userId: string,
    maxRecommendations: number = 5
  ): Promise<AgentRecommendation[]> {
    console.log('💡 Getting agent recommendations for requirements:', requirements);

    const candidates = await this.findCandidateAgents({
      capabilities: requirements,
      availabilityRequired: true,
      maxResults: 20,
      sortBy: 'performance'
    }, userId);

    const recommendations = candidates.map(agent => this.createRecommendation(agent, requirements));
    
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxRecommendations);
  }

  /**
   * Convert basic agent metadata to SwarmCapableAgent
   */
  private convertToSwarmCapableAgent(agent: any): SwarmCapableAgent {
    return {
      agentId: agent.agentId,
      name: agent.name,
      description: agent.description,
      category: agent.primaryCategory || agent.category || 'general',
      isPublic: agent.isPublic || false,
      createdAt: agent.createdAt || Date.now(),
      updatedAt: agent.updatedAt || Date.now(),
      userId: agent.userId,
      ownerId: agent.ownerId || agent.userId,
      useCases: agent.useCases || '',
      triggers: agent.triggers || [],
      selectedContextIds: agent.selectedContextIds || [],
      type: agent.type || 'agent_config',
      
      capabilities: this.generateCapabilitiesFromAgent(agent),
      specializations: this.generateSpecializationsFromCategory(agent.category),
      
      collaborationScore: this.calculateCollaborationScore(agent),
      trustScore: this.calculateTrustScore(agent),
      communicationProtocols: ['standard', 'json', 'markdown'],
      preferredRoles: this.generatePreferredRoles(agent.category),
      
      taskCompletionRate: this.generateTaskCompletionRate(agent),
      averageResponseTime: this.generateAverageResponseTime(),
      userSatisfactionScore: this.generateUserSatisfactionScore(agent),
      totalTasksCompleted: this.generateTotalTasksCompleted(agent),
      
      adaptationHistory: [],
      learningRate: 0.1,
      adaptationEnabled: true,
      
      maxConcurrentSwarms: this.calculateMaxConcurrentSwarms(agent),
      currentSwarmLoad: 0,
      lastSwarmActivity: 0,
      swarmParticipationCount: 0,
      
      version: '1.0.0',
      parentAgentId: undefined,
      evolutionGeneration: 1
    };
  }

  /**
   * Sort agents based on query criteria
   */
  private sortAgents(agents: SwarmCapableAgent[], query: AgentSearchQuery): SwarmCapableAgent[] {
    return agents.sort((a, b) => {
      if (query.sortBy === 'trust_score') {
        return (b.trustScore || 0) - (a.trustScore || 0);
      }
      if (query.sortBy === 'performance') {
        return (b.taskCompletionRate || 0) - (a.taskCompletionRate || 0);
      }
      if (query.sortBy === 'recent_activity') {
        return (b.lastSwarmActivity || 0) - (a.lastSwarmActivity || 0);
      }
      // Default to relevance (based on matching criteria)
      return this.calculateRelevanceScore(b, query) - this.calculateRelevanceScore(a, query);
    });
  }

  /**
   * Calculate relevance score for an agent based on query
   */
  private calculateRelevanceScore(agent: SwarmCapableAgent, query: AgentSearchQuery): number {
    let score = 0;

    if (query.query) {
      const queryLower = query.query.toLowerCase();
      // Check description match
      if (agent.description?.toLowerCase().includes(queryLower)) {
        score += 3;
      }
      // Check use cases match
      if (agent.useCases?.toLowerCase().includes(queryLower)) {
        score += 2;
      }
      // Check context match
      if (agent.selectedContextIds?.some(ctx => ctx.toLowerCase().includes(queryLower))) {
        score += 2;
      }
      // Check name match
      if (agent.name?.toLowerCase().includes(queryLower)) {
        score += 1;
      }
    }

    // Add performance-based score
    score += (agent.taskCompletionRate || 0) / 100;
    score += (agent.trustScore || 0) / 100;

    return score;
  }

  /**
   * Create recommendation for an agent
   */
  private createRecommendation(agent: SwarmCapableAgent, requirements: string[]): AgentRecommendation {
    const relevanceScore = this.calculateRelevanceScore(agent, { capabilities: requirements });
    
    const reasons: string[] = [];
    
    // Analyze why this agent is recommended
    if (agent.taskCompletionRate > 80) {
      reasons.push(`High task completion rate (${agent.taskCompletionRate}%)`);
    }
    
    if (agent.userSatisfactionScore > 80) {
      reasons.push(`Excellent user satisfaction (${agent.userSatisfactionScore}%)`);
    }
    
    if (agent.collaborationScore > 70) {
      reasons.push(`Strong collaboration skills (${agent.collaborationScore}%)`);
    }

    // Check capability matches
    const agentCapabilities = agent.capabilities.map(c => c.name.toLowerCase());
    const matchingCapabilities = requirements.filter(req => 
      agentCapabilities.some(cap => cap.includes(req.toLowerCase()))
    );
    
    if (matchingCapabilities.length > 0) {
      reasons.push(`Matches required capabilities: ${matchingCapabilities.join(', ')}`);
    }

    // Calculate compatibility score
    const compatibilityScore = (
      agent.collaborationScore * 0.4 +
      agent.trustScore * 0.3 +
      agent.taskCompletionRate * 0.3
    );

    // Estimate contribution based on specialization levels
    const estimatedContribution = agent.specializations.reduce((sum, spec) => {
      const levelMultiplier = spec.level === 'master' ? 1.0 : 
                             spec.level === 'expert' ? 0.8 : 
                             spec.level === 'intermediate' ? 0.6 : 0.4;
      return sum + (levelMultiplier * 25);
    }, 0);

    return {
      agent,
      relevanceScore,
      reasonsForRecommendation: reasons,
      compatibilityScore,
      estimatedContribution: Math.min(100, estimatedContribution)
    };
  }

  private generateSpecializationsFromCategory(category: string | undefined): AgentSpecialization[] {
    // Start with base specializations
    const baseSpecializations: AgentSpecialization[] = [{
      domain: 'general',
      level: 'intermediate',
      experience: 30,
      lastUsed: Date.now()
    }];

    if (!category) return baseSpecializations;

    // Add category-specific specializations
    const categorySpecialization: AgentSpecialization = {
      domain: category.toLowerCase(),
      level: 'expert',
      experience: 75,
      lastUsed: Date.now()
    };

    // Add related specializations based on category
    const relatedSpecializations = this.getRelatedSpecializations(category);

    return [...baseSpecializations, categorySpecialization, ...relatedSpecializations];
  }

  private getRelatedSpecializations(category: string): AgentSpecialization[] {
    // This can be expanded based on your domain knowledge graph
    const relatedDomains: Record<string, string[]> = {
      'fitness': ['health', 'nutrition', 'wellness'],
      'finance': ['economics', 'investment', 'risk_management'],
      'data': ['analytics', 'statistics', 'visualization'],
      // Add more categories and their related domains as needed
    };

    const domains = relatedDomains[category.toLowerCase()] || [];
    return domains.map(domain => ({
      domain,
      level: 'intermediate',
      experience: 40,
      lastUsed: Date.now()
    }));
  }

  private generatePreferredRoles(category: string | undefined): SwarmRole[] {
    // Base roles that all agents have
    const baseRoles: SwarmRole[] = [{
      name: 'coordinator',
      proficiency: 70,
      experience: 30,
      preferences: ['team_tasks']
    }];

    if (!category) return baseRoles;

    // Add category-specific roles
    const categoryRole: SwarmRole = {
      name: 'specialist',
      proficiency: 85,
      experience: 60,
      preferences: [`${category.toLowerCase()}_tasks`]
    };

    // Add complementary roles based on category
    const complementaryRoles = this.getComplementaryRoles(category);

    return [...baseRoles, categoryRole, ...complementaryRoles];
  }

  private getComplementaryRoles(category: string): SwarmRole[] {
    const roleMap: Record<string, SwarmRole[]> = {
      'fitness': [
        { name: 'analyzer', proficiency: 80, experience: 50, preferences: ['health_guidance'] },
        { name: 'validator', proficiency: 85, experience: 45, preferences: ['metrics_analysis'] }
      ],
      'finance': [
        { name: 'analyzer', proficiency: 85, experience: 55, preferences: ['risk_assessment'] },
        { name: 'validator', proficiency: 80, experience: 50, preferences: ['market_analysis'] }
      ],
      'data': [
        { name: 'integrator', proficiency: 90, experience: 70, preferences: ['advanced_analytics'] },
        { name: 'communicator', proficiency: 85, experience: 60, preferences: ['pattern_recognition'] }
      ]
      // Add more categories and their complementary roles as needed
    };

    return roleMap[category.toLowerCase()] || [];
  }

  private calculateCollaborationScore(agent: any): number {
    const baseScore = 60;
    
    // Factor in specializations
    const specializationBonus = agent.specializations?.reduce((bonus: number, spec: AgentSpecialization) => {
      const levelBonus = spec.level === 'master' ? 15 :
                        spec.level === 'expert' ? 10 :
                        spec.level === 'intermediate' ? 5 : 0;
      return bonus + levelBonus;
    }, 0) || 0;

    // Factor in experience
    const experienceBonus = Math.min(20, Math.floor((Date.now() - agent.createdAt) / (1000 * 60 * 60 * 24 * 30)));

    return Math.min(100, baseScore + specializationBonus + experienceBonus);
  }

  private calculateTrustScore(agent: any): number {
    const baseScore = agent.isPublic ? 70 : 80;
    
    // Factor in successful collaborations
    const successBonus = Math.min(15, agent.swarmParticipationCount || 0);
    
    // Factor in specialization levels
    const specializationBonus = agent.specializations?.reduce((bonus: number, spec: AgentSpecialization) => {
      return bonus + (spec.experience / 20);
    }, 0) || 0;

    return Math.min(100, baseScore + successBonus + specializationBonus);
  }

  private generateTaskCompletionRate(agent: any): number {
    // Simulate task completion rate based on primary context
    const categoryRates: Record<string, number> = {
      'data': 85,
      'finances': 88,
      'physical': 82,
      'running': 85,
      'customer_service': 90
    };
    
    // Use the first selected context as the primary context, or 'general' if none exists
    const primaryContext = agent.selectedContextIds?.[0]?.toLowerCase() || 'general';
    const baseRate = categoryRates[primaryContext] || 75;
    const variation = (Math.random() - 0.5) * 20; // ±10% variation
    
    return Math.min(100, Math.max(50, baseRate + variation));
  }

  private generateAverageResponseTime(): number {
    // Simulate response time in milliseconds (500ms to 3000ms)
    return 500 + Math.random() * 2500;
  }

  private generateUserSatisfactionScore(agent: any): number {
    // Simulate user satisfaction based on primary context
    const categoryScores: Record<string, number> = {
      'data': 80,
      'finances': 88,
      'physical': 82,
      'running': 85,
      'customer_service': 85
    };
    
    const primaryContext = agent.selectedContextIds?.[0]?.toLowerCase() || 'general';
    const baseScore = categoryScores[primaryContext] || 75;
    const variation = (Math.random() - 0.5) * 20;
    
    return Math.min(100, Math.max(60, baseScore + variation));
  }

  private generateTotalTasksCompleted(agent: any): number {
    // Simulate total tasks based on agent age and primary context
    const ageInDays = Math.floor((Date.now() - agent.createdAt) / (1000 * 60 * 60 * 24));
    const primaryContext = agent.selectedContextIds?.[0]?.toLowerCase() || 'general';
    const dailyTaskRate = primaryContext === 'customer_service' ? 5 : 
                         primaryContext === 'data' ? 3 : 2;
    
    return Math.floor(ageInDays * dailyTaskRate * (0.8 + Math.random() * 0.4));
  }

  private calculateMaxConcurrentSwarms(agent: any): number {
    // Calculate max concurrent swarms based on primary context and performance
    const contextLimits: Record<string, number> = {
      'data': 3,
      'finances': 2,
      'customer_service': 4,
      'physical': 2,
      'running': 2
    };
    
    const primaryContext = agent.selectedContextIds?.[0]?.toLowerCase() || 'general';
    return contextLimits[primaryContext] || 2;
  }
} 