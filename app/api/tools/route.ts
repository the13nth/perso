import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ToolRegistry } from "@/app/lib/tools/registry";
import { z } from 'zod';
import { listUserAgents, type AgentMetadata } from '@/lib/pinecone';
import { getPineconeClient } from "@/app/lib/pinecone";
import { createDocumentRetrievalTool } from "@/app/lib/tools/document/retrieval";
import { RetrievalService } from "@/app/lib/services/RetrievalService";
import { createActivityAnalysisTool } from "@/app/lib/tools/activity/analysis";

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

// Initialize tools registry
const toolRegistry = new ToolRegistry();
const retrievalService = new RetrievalService();

// Initialize default tools
async function initializeTools() {
  try {
    // Create and register document retrieval tool
    const documentRetrievalTool = createDocumentRetrievalTool(retrievalService);
    toolRegistry.registerTool(documentRetrievalTool);
    
    // Create and register activity analysis tool
    const activityAnalysisTool = createActivityAnalysisTool();
    toolRegistry.registerTool(activityAnalysisTool);
    
    // Add more tool initializations here as we implement them
    
  } catch (error) {
    console.error("Error initializing tools:", error);
  }
}

// Initialize tools when the module loads
initializeTools();

export async function GET() {
  try {
    const tools = toolRegistry.getAllToolsMetadata();
    const statistics = toolRegistry.getStatistics();
    
    return NextResponse.json({
      tools,
      ...statistics
    });
  } catch (error) {
    console.error("Error fetching tools:", error);
    return NextResponse.json(
      { error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate required fields
    if (!data.name || !data.description || !data.category) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate tool name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.name)) {
      return NextResponse.json(
        { error: "Tool name must start with a letter or underscore and contain only letters, numbers, and underscores" },
        { status: 400 }
      );
    }
    
    // Parse parameters schema if provided
    let schema;
    if (data.parameters) {
      try {
        schema = JSON.parse(data.parameters);
      } catch (error) {
        return NextResponse.json(
          { error: "Invalid parameters JSON schema" },
          { status: 400 }
        );
      }
    }

    // Create custom tool (implementation pending)
    // This is where we would create and register a new custom tool
    // For now, we'll just return the metadata
    
    return NextResponse.json({
      message: "Tool created successfully",
      tool: {
        name: data.name,
        description: data.description,
        category: data.category,
        isCustom: true,
        usageCount: 0,
        schema: schema
      }
    });
  } catch (error) {
    console.error("Error creating tool:", error);
    return NextResponse.json(
      { error: "Failed to create tool" },
      { status: 500 }
    );
  }
} 