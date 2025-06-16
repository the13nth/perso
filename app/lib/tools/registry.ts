import { BaseTool, ToolMetadata } from "./base/types";

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  registerTool(tool: BaseTool) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getToolMetadata(name: string): ToolMetadata | undefined {
    return this.tools.get(name)?.metadata;
  }

  getAllTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getAllToolsMetadata(): ToolMetadata[] {
    return this.getAllTools().map(tool => tool.metadata);
  }

  getStatistics() {
    const tools = this.getAllToolsMetadata();
    return {
      totalUsage: tools.reduce((sum, tool) => sum + tool.usageCount, 0),
      builtInCount: tools.filter(tool => !tool.isCustom).length,
      customCount: tools.filter(tool => tool.isCustom).length
    };
  }
} 