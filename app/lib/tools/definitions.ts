import { z } from 'zod';

// Base tool parameter schema
export const BaseToolParams = z.object({
  input: z.string(),
  context: z.record(z.any()).optional(),
});

// Tool execution result schema
export const ToolExecutionResult = z.object({
  success: z.boolean(),
  result: z.any(),
  error: z.string().optional(),
});

// Tool definition interface
export interface Tool {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (params: z.infer<typeof BaseToolParams>) => Promise<z.infer<typeof ToolExecutionResult>>;
}

// Tool registry to store all available tools
export class ToolRegistry {
  private static tools: Map<string, Tool> = new Map();

  static register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  static get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  static list(): Tool[] {
    return Array.from(this.tools.values());
  }
}

// Tool execution error
export class ToolExecutionError extends Error {
  constructor(message: string, public toolName: string) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

// Tool permission types
export type ToolPermission = {
  toolName: string;
  allowedOperations: string[];
};

// Agent tool configuration
export type AgentToolConfig = {
  tools: string[];
  permissions: ToolPermission[];
}; 