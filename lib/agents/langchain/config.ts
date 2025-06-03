// Agent configuration types and defaults
export interface AgentConfig {
  name: string;
  description: string;
  category: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  name: "Default Agent",
  description: "A general-purpose AI assistant",
  category: "general",
  model: "gpt-3.5-turbo",
  temperature: 0.7,
  maxTokens: 2048
};

export function getAgentConfig(agentId: string): Promise<AgentConfig> {
  // For now, return default config
  // TODO: Implement actual agent config retrieval from database
  return Promise.resolve({
    ...DEFAULT_AGENT_CONFIG,
    name: `Agent ${agentId}`,
  });
} 