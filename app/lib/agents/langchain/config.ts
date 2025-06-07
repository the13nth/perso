import type { AgentConfig, AgentCapability, AgentMetadata } from "./types";

export function convertPineconeAgentToConfig(agent: AgentMetadata): AgentConfig {
  // Create default capabilities from agent metadata
  const capabilities: AgentCapability[] = [
    {
      name: "knowledge_base",
      description: `Knowledge and expertise about ${agent.primaryCategory} with focus on: ${agent.agent.useCases}`,
      tools: []
    },
    {
      name: "task_execution",
      description: `Execute tasks related to: ${agent.agent.triggers.join(", ")}`,
      tools: []
    }
  ];

  // Add specific capabilities based on agent type/category
  if (agent.primaryCategory.toLowerCase().includes("fieldwork") || 
      (agent.title?.toLowerCase().includes("harakaplus") ?? false)) {
    capabilities.push({
      name: "fieldwork_assistance",
      description: "Provide assistance with fieldwork activities, data collection, and reporting",
      tools: []
    });
  }

  // Convert to AgentConfig format
  return {
    agentId: agent.contentId,
    name: agent.title || agent.contentId,
    description: agent.text || agent.agent.useCases || "No description available",
    capabilities: capabilities,
    metadata: agent
  };
} 