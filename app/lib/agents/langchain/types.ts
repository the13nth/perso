import { DynamicStructuredTool } from "@langchain/core/tools";

export interface AgentCapability {
  name: string;
  description: string;
  tools: DynamicStructuredTool[];
}

export interface AgentMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  type: string;
  capabilities: AgentCapability[];
  isPublic: boolean;
  ownerId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  dataAccess?: string[];
  selectedContextIds?: string[];
  tools?: string[];
  text?: string;
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