import { Message } from "ai";

export interface Agent {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  isPublic: boolean;
  createdAt: number;
  ownerId: string;
  selectedContextIds?: string[];
}

export interface ContextAnalysis {
  agentId: string;
  contextIds: string[];
  summary: string;
  domains: string[];
  overlaps: {
    withAgentId: string;
    sharedContexts: string[];
  }[];
}

export interface CapabilityAnalysis {
  agentId: string;
  capabilities: string[];
  triggers: string[];
  specializations: string[];
  complementary: {
    withAgentId: string;
    sharedCapabilities: string[];
  }[];
}

export interface RemixState {
  parentAgents: Agent[];
  messages: Message[];
  context: {
    analyzedContexts: ContextAnalysis[];
    mergedContextIds: string[];
  };
  capabilities: {
    analyzedCapabilities: CapabilityAnalysis[];
    mergedCapabilities: string[];
  };
  configuration: {
    name: string;
    description: string;
    category: string;
    triggers: string[];
    isPublic: boolean;
  };
  [key: string]: any; // Add index signature for GraphState compatibility
} 