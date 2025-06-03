import { z } from 'zod';
import { Tool, BaseToolParams, ToolRegistry, ToolExecutionResult } from './definitions';
import { getAgentConfig, getAgentContext } from '@/lib/pinecone';

// Enhanced query parameters schema with activity-specific fields
const UbumuntuQueryParams = BaseToolParams.extend({
  queryType: z.enum(['general', 'specific', 'technical']),
  category: z.string().optional(),
  activityType: z.enum(['progress', 'tracking', 'analysis', 'summary']).optional(),
  agentId: z.string().optional(),
});

// Activity data interface
interface ActivityData {
  id: string;
  type: string;
  timestamp: string;
  status: string;
  progress?: number;
  details?: string;
}

interface ContextDocument {
  pageContent?: string;
  metadata?: {
    id?: string;
    type?: string;
    timestamp?: string;
    status?: string;
    progress?: number;
    score?: number;
  };
}

// Context analyzer functions
const contextAnalyzer = {
  async getAgentMetadata(agentId: string) {
    try {
      const agentConfig = await getAgentConfig(agentId);
      return {
        category: agentConfig.category,
        description: agentConfig.description,
        useCases: agentConfig.useCases,
        selectedContextIds: agentConfig.selectedContextIds
      };
    } catch (error) {
      console.error('Error getting agent metadata:', error);
      return null;
    }
  },

  async queryContext(input: string, agentId: string) {
    try {
      const contextDocs = await getAgentContext(agentId, input);
      return contextDocs.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));
    } catch (error) {
      console.error('Error querying context:', error);
      return [];
    }
  },

  extractActivities(contextDocs: ContextDocument[]): ActivityData[] {
    return contextDocs.map(doc => {
      // Try to extract activity information from the context
      const content = doc.pageContent || '';
      const metadata = doc.metadata || {};
      
      return {
        id: metadata.id || String(Math.random()),
        type: metadata.type || this.inferActivityType(content),
        timestamp: metadata.timestamp || new Date().toISOString(),
        status: metadata.status || this.inferActivityStatus(content),
        progress: metadata.progress || this.inferProgress(content),
        details: content
      };
    }).filter(activity => activity.type && activity.details);
  },

  inferActivityType(content: string): string {
    if (content.toLowerCase().includes('learning')) return 'learning';
    if (content.toLowerCase().includes('project')) return 'project';
    if (content.toLowerCase().includes('task')) return 'task';
    return 'general';
  },

  inferActivityStatus(content: string): string {
    if (content.toLowerCase().includes('complete')) return 'completed';
    if (content.toLowerCase().includes('progress')) return 'in_progress';
    if (content.toLowerCase().includes('start')) return 'started';
    return 'in_progress';
  },

  inferProgress(content: string): number {
    // Try to extract percentage from content
    const percentMatch = content.match(/(\d+)%/);
    if (percentMatch) return Number(percentMatch[1]);
    
    // Infer based on status
    if (content.toLowerCase().includes('complete')) return 100;
    if (content.toLowerCase().includes('start')) return 0;
    return 50; // Default to 50% for in-progress
  },

  
};

// Activity analysis functions
const activityAnalyzer = {
  getProgress: (activities: ActivityData[]) => {
    const total = activities.length;
    const completed = activities.filter(a => a.status === 'completed').length;
    const avgProgress = activities.reduce((acc, curr) => acc + (curr.progress || 0), 0) / total;
    
    return {
      total,
      completed,
      inProgress: total - completed,
      averageProgress: Math.round(avgProgress),
    };
  },
  
  getTimeline: (activities: ActivityData[]) => {
    return activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },
  
  getSummary: (activities: ActivityData[]) => {
    const byType = activities.reduce((acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      byType,
      totalActivities: activities.length,
      latestActivity: activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0],
    };
  }
};

// Enhanced Ubumuntu query tool implementation
const ubumuntuQueryTool: Tool = {
  name: 'ubumuntuQuery',
  description: 'Execute queries on the Ubumuntu platform using Pinecone context',
  schema: UbumuntuQueryParams,
  execute: async (params): Promise<z.infer<typeof ToolExecutionResult>> => {
    try {
      const { input, queryType, category, activityType, agentId } = UbumuntuQueryParams.parse(params);
      
      if (!agentId) {
        throw new Error('Agent ID is required for context querying');
      }

      // Get agent metadata first
      const agentMetadata = await contextAnalyzer.getAgentMetadata(agentId);
      if (!agentMetadata) {
        return {
          success: false,
          error: 'Failed to retrieve agent metadata',
          result: null
        };
      }

      // Query the context
      const contextDocs = await contextAnalyzer.queryContext(input, agentId);
      if (!contextDocs.length) {
        return {
          success: false,
          error: 'No relevant context found',
          result: null
        };
      }

      // Extract activities from context
      const activities = contextAnalyzer.extractActivities(contextDocs);
      
      // Handle activity-related queries
      if (category?.includes('activity')) {
        let result;
        switch (activityType) {
          case 'progress':
            result = {
              type: 'progress_report',
              data: activityAnalyzer.getProgress(activities),
              message: 'Activity progress analysis completed',
              context: 'Based on analysis of your activity context'
            };
            break;
          
          case 'tracking':
            result = {
              type: 'activity_timeline',
              data: activityAnalyzer.getTimeline(activities),
              message: 'Activity tracking information retrieved',
              context: 'Timeline generated from your activity context'
            };
            break;
          
          case 'analysis':
            result = {
              type: 'detailed_analysis',
              data: {
                progress: activityAnalyzer.getProgress(activities),
                timeline: activityAnalyzer.getTimeline(activities),
                summary: activityAnalyzer.getSummary(activities)
              },
              message: 'Comprehensive activity analysis completed',
              context: 'Analysis based on your activity context'
            };
            break;
          
          case 'summary':
            result = {
              type: 'activity_summary',
              data: activityAnalyzer.getSummary(activities),
              message: 'Activity summary generated',
              context: 'Summary based on your activity context'
            };
            break;
          
          default:
            result = {
              type: 'general_info',
              data: activities,
              message: 'General activity information retrieved',
              context: 'Information extracted from your context'
            };
        }

        return {
          success: true,
          result
        };
      }

      // Return the query results with context
      return {
        success: true,
        result: {
          query: input,
          type: queryType,
          category: agentMetadata.category,
          contextFound: contextDocs.length,
          relevantContent: contextDocs.map(doc => ({
            content: doc.pageContent,
            metadata: doc.metadata
          })),
          agentContext: {
            category: agentMetadata.category,
            description: agentMetadata.description,
            useCases: agentMetadata.useCases,
            selectedContextIds: agentMetadata.selectedContextIds
          },
          message: 'Query processed with Pinecone context',
          timestamp: new Date().toISOString(),
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        result: null,
      };
    }
  },
};

// Register the tool
ToolRegistry.register(ubumuntuQueryTool);

// Export the tool for direct access
export { ubumuntuQueryTool };

// Base params that all context tools share
const BaseContextParams = z.object({
  agentId: z.string(),
  input: z.string()
});

// Activity Summary Tool
const ActivitySummaryParams = BaseContextParams.extend({
  queryType: z.enum(['general', 'specific', 'technical']).default('general'),
  category: z.string().optional(),
  activityType: z.enum(['progress', 'tracking', 'analysis', 'summary']).optional(),
  timeframe: z.enum(['day', 'week', 'month', 'all']).default('all'),
  type: z.enum(['all', 'learning', 'task', 'project']).default('all')
});

const activitySummaryTool: Tool = {
  name: 'getActivitySummary',
  description: 'Get a summarized view of user activities with statistics and trends',
  schema: ActivitySummaryParams,
  execute: async (params) => {
    try {
      const { agentId, timeframe, type, queryType, category, activityType } = ActivitySummaryParams.parse(params);
      
      console.log('Activity Summary Tool Parameters:', {
        agentId,
        timeframe,
        type,
        queryType,
        category,
        activityType
      });

      // Get context and analyze activities
      const contextDocs = await contextAnalyzer.queryContext(agentId, type);
      const activities = contextAnalyzer.extractActivities(contextDocs);
      const summary = activityAnalyzer.getSummary(activities);
      
      return {
        success: true,
        result: {
          summary,
          trends: activityAnalyzer.getTimeline(activities),
          recentHighlights: activities.slice(0, 5),
          queryDetails: {
            type: queryType,
            category,
            activityType
          }
        }
      };
    } catch (error) {
      console.error('Activity summary tool error:', error);
      return { success: false, error: String(error), result: null };
    }
  }
};

// Progress Tracking Tool
const ProgressTrackingParams = BaseContextParams.extend({
  goalId: z.string().optional(),
  category: z.string().optional()
});

const progressTrackingTool: Tool = {
  name: 'trackProgress',
  description: 'Track progress towards specific goals or in specific categories',
  schema: ProgressTrackingParams,
  execute: async (params) => {
    try {
      const { agentId } = ProgressTrackingParams.parse(params);
      const contextDocs = await contextAnalyzer.queryContext(agentId, 'progress');
      const activities = contextAnalyzer.extractActivities(contextDocs);
      const progress = activityAnalyzer.getProgress(activities);
      
      return {
        success: true,
        result: {
          currentProgress: progress.averageProgress,
          historicalTrend: activityAnalyzer.getTimeline(activities),
          nextMilestones: activities.filter(a => a.status !== 'completed').slice(0, 3)
        }
      };
    } catch (error) {
      return { success: false, error: String(error), result: null };
    }
  }
};

// Learning Analysis Tool
const LearningAnalysisParams = BaseContextParams.extend({
  topic: z.string().optional(),
  depth: z.enum(['basic', 'detailed']).default('basic')
});

const learningAnalysisTool: Tool = {
  name: 'analyzeLearning',
  description: 'Analyze learning activities and knowledge acquisition',
  schema: LearningAnalysisParams,
  execute: async (params) => {
    try {
      const { agentId } = LearningAnalysisParams.parse(params);
      const contextDocs = await contextAnalyzer.queryContext(agentId, 'learning');
      const activities = contextAnalyzer.extractActivities(contextDocs)
        .filter(a => a.type === 'learning');
      
      return {
        success: true,
        result: {
          topicsLearned: Array.from(new Set(activities.map(a => a.details))),
          comprehensionLevels: activityAnalyzer.getProgress(activities),
          recommendations: activities.filter(a => a.status !== 'completed').map(a => a.details)
        }
      };
    } catch (error) {
      return { success: false, error: String(error), result: null };
    }
  }
};

// Context Search Tool
const ContextSearchParams = BaseContextParams.extend({
  searchType: z.enum(['semantic', 'exact', 'related']).default('semantic'),
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
});

const contextSearchTool: Tool = {
  name: 'searchContext',
  description: 'Search through user context with advanced filtering options',
  schema: ContextSearchParams,
  execute: async (params) => {
    try {
      const { agentId, input } = ContextSearchParams.parse(params);
      const contextDocs = await contextAnalyzer.queryContext(agentId, input);
      const activities = contextAnalyzer.extractActivities(contextDocs);
      
      return {
        success: true,
        result: {
          matches: activities,
          relatedTopics: Array.from(new Set(activities.map(a => a.type))),
          suggestedQueries: ['learning', 'progress', 'completed']
        }
      };
    } catch (error) {
      return { success: false, error: String(error), result: null };
    }
  }
};

// Register all tools
[activitySummaryTool, progressTrackingTool, learningAnalysisTool, contextSearchTool].forEach(tool => {
  ToolRegistry.register(tool);
});

export { activitySummaryTool, progressTrackingTool, learningAnalysisTool, contextSearchTool }; 