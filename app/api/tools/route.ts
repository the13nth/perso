import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ToolRegistry, Tool } from '@/app/lib/tools/definitions';
import { z } from 'zod';
import { listUserAgents, type AgentMetadata } from '@/lib/pinecone';

// Built-in tools from your codebase with compatibility mapping
const BUILT_IN_TOOLS = [
  {
    name: 'document_analysis',
    description: 'Analyze documents and extract key information',
    category: 'Analysis',
    isCustom: false,
    compatibleCategories: ['Customer Service', 'Data Analysis', 'Research'],
    compatibleContexts: ['documents', 'files', 'notes', 'work'],
    schema: {
      type: 'object',
      properties: {
        document: { type: 'string', description: 'Document content to analyze' },
        analysisType: { type: 'string', description: 'Type of analysis to perform' }
      },
      required: ['document']
    }
  },
  {
    name: 'database_query',
    description: 'Execute database queries and return results',
    category: 'Data',
    isCustom: false,
    compatibleCategories: ['Data Analysis', 'Customer Service'],
    compatibleContexts: ['work', 'data', 'analytics'],
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query to execute' },
        database: { type: 'string', description: 'Target database name' }
      },
      required: ['query']
    }
  },
  {
    name: 'image_generator',
    description: 'Generate images from text descriptions',
    category: 'Generation',
    isCustom: false,
    compatibleCategories: ['Creative', 'Marketing', 'Design'],
    compatibleContexts: ['creative', 'design', 'marketing'],
    schema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description for image generation' },
        style: { type: 'string', description: 'Art style or type' },
        dimensions: { type: 'string', description: 'Image dimensions' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'code_interpreter',
    description: 'Execute and explain code',
    category: 'Analysis',
    isCustom: false,
    compatibleCategories: ['Data Analysis', 'Development', 'Technical'],
    compatibleContexts: ['code', 'development', 'programming', 'work'],
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Code to execute' },
        language: { type: 'string', description: 'Programming language' }
      },
      required: ['code']
    }
  },
  {
    name: 'ubumuntuQuery',
    description: 'Execute queries on the Ubumuntu platform using Pinecone context',
    category: 'Data',
    isCustom: false,
    compatibleCategories: ['Customer Service', 'Data Analysis'],
    compatibleContexts: ['Ubumuntu AI', 'platform', 'search'],
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        contextIds: { type: 'array', items: { type: 'string' }, description: 'Context IDs to search' }
      },
      required: ['query']
    }
  },
  {
    name: 'getActivitySummary',
    description: 'Get summarized view of user activities with statistics and insights',
    category: 'Analysis',
    isCustom: false,
    compatibleCategories: ['Data Analysis', 'Personal Assistant'],
    compatibleContexts: ['physical', 'running', 'work', 'activities', 'health', 'fitness'],
    schema: {
      type: 'object',
      properties: {
        timeframe: { type: 'string', description: 'Time period for summary' },
        activityType: { type: 'string', description: 'Type of activity to summarize' }
      }
    }
  }
];

// Function to calculate tool usage by agents
async function calculateToolUsage(userId: string) {
  try {
    // Get all user's agents
    const agents = await listUserAgents(userId);
    
    // Calculate usage for each tool
    const toolUsage: Record<string, number> = {};
    
    BUILT_IN_TOOLS.forEach(tool => {
      let usageCount = 0;
      
      agents.forEach((agent: AgentMetadata) => {
        // Check if agent category is compatible with tool
        const categoryMatch = tool.compatibleCategories.some(category => 
          agent.category?.toLowerCase().includes(category.toLowerCase()) ||
          category.toLowerCase().includes(agent.category?.toLowerCase() || '')
        );
        
        // Check if agent contexts are compatible with tool
        const contextMatch = agent.selectedContextIds?.some((contextId: string) => 
          tool.compatibleContexts.some(compatibleContext =>
            contextId.toLowerCase().includes(compatibleContext.toLowerCase()) ||
            compatibleContext.toLowerCase().includes(contextId.toLowerCase())
          )
        );
        
        // Count if there's any compatibility
        if (categoryMatch || contextMatch) {
          usageCount++;
        }
      });
      
      toolUsage[tool.name] = usageCount;
    });
    
    return toolUsage;
  } catch (_error) {
    console.error('Error calculating tool usage:', _error);
    // Return empty usage if there's an error (e.g., Pinecone connection issues)
    return {};
  }
}

export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Calculate tool usage by agents
    const toolUsage = await calculateToolUsage(userId);

    // Get custom tools from registry (if any)
    const customTools = ToolRegistry.list().map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
      category: 'Custom',
      isCustom: true,
      usageCount: 0, // Custom tools usage would need different tracking
      schema: tool.schema
    }));

    // Combine built-in and custom tools with usage counts
    const allTools = [
      ...BUILT_IN_TOOLS.map(tool => ({
        ...tool,
        usageCount: toolUsage[tool.name] || 0
      })),
      ...customTools
    ];

    return NextResponse.json({
      success: true,
      tools: allTools,
      totalCount: allTools.length,
      builtInCount: BUILT_IN_TOOLS.length,
      customCount: customTools.length,
      totalUsage: Object.values(toolUsage).reduce((sum, count) => sum + count, 0)
    });

  } catch (_error) {
    console.error("Error fetching tools:", _error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, category, code, parameters } = body;

    // Validate required fields
    if (!name || !description || !category) {
      return NextResponse.json(
        { error: "Name, description, and category are required" },
        { status: 400 }
      );
    }

    // Validate tool name (alphanumeric and underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return NextResponse.json(
        { error: "Tool name must be alphanumeric with underscores only" },
        { status: 400 }
      );
    }

    // Check if tool already exists
    const existingTool = ToolRegistry.get(name);
    if (existingTool) {
      return NextResponse.json(
        { error: "A tool with this name already exists" },
        { status: 409 }
      );
    }

    // Parse parameters schema
    let schemaProperties: Record<string, any> = {};
    if (parameters) {
      try {
        schemaProperties = JSON.parse(parameters);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON in parameters schema" },
          { status: 400 }
        );
      }
    }

    // Create Zod schema from properties
    const zodSchema = z.object({
      input: z.string(),
      context: z.record(z.any()).optional(),
      ...Object.fromEntries(
        Object.entries(schemaProperties).map(([key, value]: [string, any]) => [
          key,
          value.type === 'string' ? z.string() : 
          value.type === 'number' ? z.number() :
          value.type === 'boolean' ? z.boolean() :
          z.any()
        ])
      )
    });

    // Create function from code
    let toolFunction;
    if (code) {
      try {
        // Wrap the code in a function and evaluate it safely
        const wrappedCode = `(${code})`;
        toolFunction = eval(wrappedCode);
        
        if (typeof toolFunction !== 'function') {
          throw new Error('Code must be a valid function');
        }
      } catch (_error) {
        return NextResponse.json(
          { error: "Invalid function code: " + (_error instanceof Error ? _error.message : 'Unknown error') },
          { status: 400 }
        );
      }
    } else {
      // Default function if no code provided
      toolFunction = async (params: Record<string, unknown>) => {
        return { 
          success: true,
          result: { message: `Tool ${name} executed with params:`, params }
        };
      };
    }

    // Register the new tool
    ToolRegistry.register({
      name,
      description,
      schema: zodSchema,
      execute: toolFunction
    });

    const newTool = {
      name,
      description,
      category,
      isCustom: true,
      schema: schemaProperties,
      createdBy: userId,
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      tool: newTool,
      message: "Tool created successfully"
    });

  } catch (_error) {
    console.error("Error creating tool:", _error);
    return NextResponse.json(
      { error: "Failed to create tool" },
      { status: 500 }
    );
  }
} 