import { Tool } from "langchain/tools";

export interface ToolMetadata {
  name: string;
  description: string;
  category: string;
  isCustom: boolean;
  usageCount: number;
  schema?: Record<string, any>;
  [key: string]: unknown;
}

export interface BaseToolConfig {
  metadata: ToolMetadata;
}

export interface ToolResult {
  success: boolean;
  result: any;
  error?: string;
}

export interface BaseTool {
  name: string;
  description: string;
  metadata: ToolMetadata;
  execute: (input: any) => Promise<ToolResult>;
}

export class CustomTool implements BaseTool {
  name: string;
  description: string;
  metadata: ToolMetadata;
  private executeFn: (input: any) => Promise<ToolResult>;

  constructor(config: BaseToolConfig, executeFn: (input: any) => Promise<ToolResult>) {
    this.metadata = config.metadata;
    this.name = config.metadata.name;
    this.description = config.metadata.description;
    this.executeFn = executeFn;
  }

  async execute(input: any): Promise<ToolResult> {
    try {
      return await this.executeFn(input);
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getMetadata(): ToolMetadata {
    return this.metadata;
  }
} 