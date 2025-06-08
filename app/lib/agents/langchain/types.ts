
export interface AgentCapability {
  name: string;
  description: string;
  priority?: number;
  tools?: string[];
}

export interface AgentPerformanceMetrics {
  taskCompletionRate: number;
  averageResponseTime: number;
  userSatisfactionScore: number;
  totalTasksCompleted: number;
}

export interface AgentSpecificMetadata {
  type: 'agent_config';
  capabilities: AgentCapability[];
  tools: string[];
  useCases: string;
  triggers: string[];
  isPublic: boolean;
  ownerId: string;
  dataAccess: string[];
  selectedContextIds: string[];
  performanceMetrics: AgentPerformanceMetrics;
}

export interface AgentMetadata {
  contentId: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  selectedContextIds: string[];
  isPublic: boolean;
  ownerId: string;
  type: string;
  createdAt: number;
  updatedAt: number;
  primaryCategory?: string;
  agent?: {
    isPublic: boolean;
    type: string;
    capabilities: string[];
    tools: string[];
    useCases: string;
    triggers: string[];
    ownerId: string;
    dataAccess: string[];
    selectedContextIds: string[];
    performanceMetrics: {
      taskCompletionRate: number;
      averageResponseTime: number;
      userSatisfactionScore: number;
      totalTasksCompleted: number;
    };
  };
}

export interface AgentConfig {
  agentId: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  metadata?: AgentMetadata;
}

export interface MergedCapability extends AgentCapability {
  sourceAgents: string[];
  priority: number;
}

export interface SuperAgentConfig extends AgentConfig {
  parentAgents: string[];
  mergedCapabilities: MergedCapability[];
}

export interface CapabilityMergeResult {
  success: boolean;
  mergedCapabilities: MergedCapability[];
  error?: string;
}

export interface AgentMessage {
  content: string;
  role: "user" | "assistant";
  agentId: string;
  capability?: string;
}

export interface ProcessingStep {
  id: string;
  label: string;
  type: 'input' | 'process' | 'output';
  status: 'pending' | 'running' | 'completed' | 'error';
  details: string;
  timestamp: number;
  metadata?: {
    agentId?: string;
    capability?: string;
    confidence?: number;
    processingTime?: number;
  };
}

export interface Context {
  pageContent: string;
  metadata: {
    source?: string;
    score?: number;
    title?: string;
  };
}

export interface AgentResponse {
  response: string;
  steps?: ProcessingStep[];
  error?: string;
}

export interface TaskResult {
  success: boolean;
  response: string;
  confidence: number;
  metadata?: Record<string, any>;
} 