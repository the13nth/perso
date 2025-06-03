import { ToolRegistry, ToolExecutionError, ToolPermission } from './definitions';
import { z } from 'zod';
import { ToolExecutionResult } from './definitions';

export class ToolExecutor {
  private static instance: ToolExecutor;

  private constructor() {}

  static getInstance(): ToolExecutor {
    if (!ToolExecutor.instance) {
      ToolExecutor.instance = new ToolExecutor();
    }
    return ToolExecutor.instance;
  }

  async validatePermissions(toolName: string, permissions: ToolPermission[]): Promise<boolean> {
    const toolPermission = permissions.find(p => p.toolName === toolName);
    if (!toolPermission) {
      throw new ToolExecutionError(`No permissions found for tool: ${toolName}`, toolName);
    }
    return true;
  }

  async execute(
    toolName: string,
    params: { input: string; context?: Record<string, unknown> },
    permissions: ToolPermission[]
  ): Promise<z.infer<typeof ToolExecutionResult>> {
    try {
      // Get tool from registry
      const tool = ToolRegistry.get(toolName);
      if (!tool) {
        throw new ToolExecutionError(`Tool not found: ${toolName}`, toolName);
      }

      // Validate permissions
      await this.validatePermissions(toolName, permissions);

      // Execute tool
      const result = await tool.execute(params);
      
      // Log execution (you can implement proper logging here)
      console.log(`Tool ${toolName} executed successfully`, {
        params,
        success: result.success,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage,
        result: null,
      };
    }
  }
} 