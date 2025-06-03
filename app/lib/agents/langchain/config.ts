import type { AgentConfig, AgentCapability } from "./types";
import type { AgentMetadata } from "@/lib/pinecone";

export function convertPineconeAgentToConfig(agent: AgentMetadata): AgentConfig {
  // Create default capabilities from agent metadata
  const capabilities: AgentCapability[] = [
    {
      name: "knowledge_base",
      description: `Knowledge and expertise about ${agent.category} with focus on: ${agent.useCases}`,
      tools: []
    },
    {
      name: "task_execution",
      description: `Execute tasks related to: ${agent.triggers.join(", ")}`,
      tools: []
    }
  ];

  // Add specific capabilities based on agent type/category
  if (agent.category.toLowerCase().includes("fieldwork") || 
      agent.name.toLowerCase().includes("harakaplus")) {
    capabilities.push({
      name: "fieldwork_assistance",
      description: "Provide assistance with fieldwork activities, data collection, and reporting",
      tools: []
    });
  }

  // Convert to AgentConfig format
  return {
    agentId: agent.agentId,
    name: agent.name,
    description: agent.description,
    capabilities: capabilities
  };
} 