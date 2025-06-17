import { ContextManager } from '../../services/context';
import type { ProcessedContext } from '../../services/context/types';

export interface AgentContextOptions {
  userId: string;
  categories?: string[];
  includeProjectContext?: boolean;
  includeUserHistory?: boolean;
  maxContextSize?: number;
  minBridgeStrength?: number;
}

export class AgentContextProvider {
  private contextManager: ContextManager;
  private readonly DEFAULT_MAX_CONTEXT_SIZE = 10;
  private readonly DEFAULT_MIN_BRIDGE_STRENGTH = 0.7;
  
  constructor() {
    this.contextManager = new ContextManager();
  }
  
  async getContextForAgent(
    agentId: string,
    options: AgentContextOptions
  ): Promise<ProcessedContext> {
    const categories = await this.determineCategories(agentId, options);
    
    const enhancedContext = await this.contextManager.getEnhancedContext(
      categories,
      options.userId,
      {
        maxVectors: options.maxContextSize || this.DEFAULT_MAX_CONTEXT_SIZE,
        minBridgeStrength: options.minBridgeStrength || this.DEFAULT_MIN_BRIDGE_STRENGTH,
        includeSecondaryBridges: true
      }
    );
    
    return enhancedContext;
  }
  
  private async determineCategories(
    agentId: string,
    options: AgentContextOptions
  ): Promise<string[]> {
    const categories = new Set<string>();
    
    // Add explicitly requested categories
    if (options.categories) {
      options.categories.forEach(c => categories.add(c));
    }
    
    // Add project context if requested
    if (options.includeProjectContext) {
      const projectCategories = await this.getProjectCategories(agentId);
      projectCategories.forEach(c => categories.add(c));
    }
    
    // Add user history if requested
    if (options.includeUserHistory) {
      const historyCategories = await this.getUserHistoryCategories(options.userId);
      historyCategories.forEach(c => categories.add(c));
    }
    
    return Array.from(categories);
  }
  
  private async getProjectCategories(agentId: string): Promise<string[]> {
    // This would typically fetch from your project metadata store
    // For now, return some default project-related categories
    return [
      'project-structure',
      'code-patterns',
      'documentation',
      'dependencies'
    ];
  }
  
  private async getUserHistoryCategories(userId: string): Promise<string[]> {
    // This would typically fetch from your user interaction history
    // For now, return some default user-related categories
    return [
      'user-preferences',
      'recent-interactions',
      'common-patterns'
    ];
  }
} 