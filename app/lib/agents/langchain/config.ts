import type { AgentConfig, AgentCapability, AgentMetadata } from "./types";

export function convertPineconeAgentToConfig(agent: AgentMetadata): AgentConfig {
  // Create default capabilities from agent metadata
  const capabilities: AgentCapability[] = [
    {
      name: "knowledge_base",
      description: `Knowledge and expertise about ${agent.primaryCategory || 'general'} with focus on: ${agent.agent?.useCases || 'general tasks'}`,
      tools: []
    },
    {
      name: "task_execution",
      description: `Execute tasks related to: ${agent.agent?.triggers?.join(", ") || 'general tasks'}`,
      tools: []
    }
  ];

  // Add specific capabilities based on agent type/category
  if ((agent.primaryCategory || '').toLowerCase().includes("fieldwork") || 
      (agent.name?.toLowerCase().includes("harakaplus") ?? false)) {
    capabilities.push({
      name: "fieldwork_assistance",
      description: "Provide assistance with fieldwork activities, data collection, and reporting",
      tools: []
    });
  }

  // Convert to AgentConfig format
  return {
    agentId: agent.contentId,
    name: agent.name || agent.contentId,
    description: agent.description || agent.agent?.useCases || "No description available",
    capabilities: capabilities,
    metadata: agent
  };
} 