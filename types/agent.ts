export interface AgentConfig {
  agentId: string;
  name: string;
  description: string;
  category?: string;
  capabilities?: AgentCapability[];
  metadata?: {
    type: string;
    contentId: string;
    userId: string;
    name: string;
    description: string;
    category: string;
    useCases: string;
    isPublic: boolean;
    ownerId: string;
    selectedContextIds: string[];
    createdAt: number;
    updatedAt: number;
    agent?: {
      type: string;
      capabilities: string[];
      tools: string[];
      useCases: string;
      triggers: string[];
      selectedContextIds: string[];
      isPublic: boolean;
      ownerId: string;
      dataAccess: string[];
      performanceMetrics: {
        taskCompletionRate: number;
        averageResponseTime: number;
        userSatisfactionScore: number;
        totalTasksCompleted: number;
      };
    };
  };
}

export interface AgentCapability {
  name: string;
  type: string;
  proficiencyLevel: number;
  domains: string[];
  prerequisites: string[];
  description: string;
  examples: string[];
  lastUpdated: number;
  usageCount: number;
  successRate: number;
}

export interface AgentRecommendation {
  agent: AgentConfig;
  relevanceScore: number;
  reasonsForRecommendation: string[];
  compatibilityScore: number;
  estimatedContribution: number;
} 