import { AgentContextProvider, type AgentContextOptions } from './context/AgentContextProvider';
import { type ProcessedContext } from '../services/context/types';

export interface AgentConfig {
  agentId: string;
  userId: string;
  contextOptions?: AgentContextOptions;
  // Add other agent configuration options as needed
}

export class AgentFactory {
  private contextProvider: AgentContextProvider;
  
  constructor() {
    this.contextProvider = new AgentContextProvider();
  }
  
  async createAgent(config: AgentConfig) {
    // Get enhanced context for the agent
    const context = await this.getAgentContext(config);
    
    // Create the agent with enhanced context
    const agent = await this.buildAgent(config, context);
    
    return agent;
  }
  
  private async getAgentContext(config: AgentConfig): Promise<ProcessedContext> {
    const contextOptions: AgentContextOptions = {
      userId: config.userId,
      ...config.contextOptions,
      // Default to including project context
      includeProjectContext: config.contextOptions?.includeProjectContext ?? true
    };
    
    return this.contextProvider.getContextForAgent(config.agentId, contextOptions);
  }
  
  private async buildAgent(config: AgentConfig, context: ProcessedContext) {
    // Here you would instantiate your specific agent type
    // and configure it with the enhanced context
    
    // This is a placeholder for your actual agent creation logic
    const agent = {
      id: config.agentId,
      userId: config.userId,
      context,
      // Add other agent properties and methods
    };
    
    return agent;
  }
} 