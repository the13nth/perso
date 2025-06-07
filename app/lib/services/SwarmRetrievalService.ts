import { SwarmSession, SubTask, SwarmResult} from '@/types/swarm';
import { v4 as uuidv4 } from 'uuid';
import { getAgentContext } from '../pinecone';
import { AgentDiscoveryService } from '@/lib/services/AgentDiscoveryService';

interface RetrievalSwarmConfig {
  userId: string;
  query: string;
  contextType?: string;
  maxAgents?: number;
  timeoutSeconds?: number;
  analysisType?: string;
}

interface AnalysisMetric {
  name: string;
  value: string | number;
  type: 'numeric' | 'text' | 'status' | 'duration';
  unit?: string;
}

interface ActivityAnalysis {
  summary: string[];
  metrics: AnalysisMetric[];
  patterns: Record<string, any>;
  recommendations: string[];
}

export class SwarmRetrievalService {
  private agentDiscovery: AgentDiscoveryService;

  constructor() {
    this.agentDiscovery = new AgentDiscoveryService();
  }

  /**
   * Create a new swarm session for retrieval and analysis
   */
  async createRetrievalSwarm(config: RetrievalSwarmConfig): Promise<SwarmSession> {
    console.log('🔍 Creating retrieval swarm for query:', config.query);
    console.log('Search configuration:', {
      query: config.query,
      capabilities: ['semantic_search', 'content_analysis'],
      maxResults: config.maxAgents || 3,
      sortBy: 'relevance'
    });

    // Find suitable agents based on query content
    const candidateAgents = await this.agentDiscovery.findCandidateAgents({
      query: config.query,
      capabilities: ['semantic_search', 'content_analysis'],
      maxResults: config.maxAgents || 3,
      sortBy: 'relevance'
    }, config.userId);

    console.log('Found candidate agents:', candidateAgents);

    if (candidateAgents.length === 0) {
      throw new Error('No suitable agents found for this retrieval task');
    }

    // Find the most relevant agent for this query
    const mostRelevantAgent = candidateAgents.reduce((best, current) => {
      // Check if current agent's contexts or description match the query better
      const queryTerms = config.query.toLowerCase().split(/\s+/);
      const currentScore = queryTerms.reduce((score, term) => {
        if (current.selectedContextIds?.some(ctx => ctx.toLowerCase().includes(term))) score += 2;
        if (current.description?.toLowerCase().includes(term)) score += 1;
        return score;
      }, 0);
      
      const bestScore = queryTerms.reduce((score, term) => {
        if (best.selectedContextIds?.some(ctx => ctx.toLowerCase().includes(term))) score += 2;
        if (best.description?.toLowerCase().includes(term)) score += 1;
        return score;
      }, 0);

      return currentScore > bestScore ? current : best;
    }, candidateAgents[0]);

    console.log('Selected most relevant agent:', mostRelevantAgent.name);

    // Create subtasks for the retrieval process
    const subTasks: SubTask[] = [
      {
        id: uuidv4(),
        description: `Analyze query: "${config.query}"`,
        status: 'pending',
        assignedAgentId: mostRelevantAgent.agentId,
        estimatedDuration: 2,
        parentTaskId: ''
      },
      {
        id: uuidv4(),
        description: `Retrieve and process relevant context for: "${config.query}"`,
        status: 'pending',
        assignedAgentId: mostRelevantAgent.agentId,
        estimatedDuration: 3,
        parentTaskId: ''
      },
      {
        id: uuidv4(),
        description: `Generate comprehensive response for: "${config.query}"`,
        status: 'pending',
        assignedAgentId: mostRelevantAgent.agentId,
        estimatedDuration: 5,
        parentTaskId: ''
      }
    ];

    // Create the swarm session
    const session: SwarmSession = {
      sessionId: uuidv4(),
      userId: config.userId,
      status: 'forming',
      task: {
        id: uuidv4(),
        description: config.query,
        type: 'retrieval',
        priority: 'medium',
        requirements: [
          {
            type: 'capability',
            value: 'semantic_search',
            importance: 'required'
          },
          {
            type: 'capability',
            value: 'content_analysis',
            importance: 'required'
          }
        ],
        decomposition: {
          subTasks,
          dependencies: [],
          estimatedComplexity: 0.5,
          requiredCapabilities: ['semantic_search', 'content_analysis']
        }
      },
      activeAgents: candidateAgents.map(agent => agent.agentId),
      coordinatorAgent: mostRelevantAgent.agentId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageLog: [],
      results: [],
      metadata: {
        contentType: 'document',
        contentId: uuidv4(),
        userId: config.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        status: 'active',
        chunkIndex: 0,
        totalChunks: 1,
        isFirstChunk: true,
        access: 'personal',
        sharedWith: [],
        categories: ['retrieval'],
        primaryCategory: 'retrieval',
        secondaryCategories: [],
        tags: ['swarm', 'retrieval'],
        title: `Retrieval Session: ${config.query}`,
        text: config.query,
        summary: `Swarm-based retrieval for: ${config.query}`,
        searchableText: config.query,
        keywords: [],
        language: 'en',
        relatedIds: [],
        references: []
      }
    };

    return session;
  }

  private analyzeActivities(activities: any[], type: string): ActivityAnalysis {
    // Generic activity analysis
    const analysis: ActivityAnalysis = {
      summary: [],
      metrics: [],
      patterns: {},
      recommendations: []
    };

    if (!activities || activities.length === 0) {
      return analysis;
    }

    // Get all possible fields from activities
    const fields = new Set<string>();
    activities.forEach(activity => {
      Object.keys(activity).forEach(key => fields.add(key));
    });

    // Analyze each field
    fields.forEach(field => {
      const values = activities.map(a => a[field]).filter(v => v !== undefined);
      if (values.length === 0) return;

      // Numeric analysis
      if (typeof values[0] === 'number' || !isNaN(parseFloat(values[0]))) {
        const numbers = values.map(v => parseFloat(v));
        const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const max = Math.max(...numbers);
        const min = Math.min(...numbers);

        analysis.metrics.push({
          name: field,
          value: avg.toFixed(2),
          type: 'numeric',
          unit: this.inferUnit(field)
        });

        analysis.patterns[field] = { min, max, avg };
      }
      // Status/category analysis
      else {
        const frequency = values.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const [mostCommon] = Object.entries(frequency)
          .sort((a, b) => (b[1] as number) - (a[1] as number));

        if (mostCommon) {
          analysis.metrics.push({
            name: field,
            value: mostCommon[0],
            type: 'text'
          });
          analysis.patterns[field] = frequency;
        }
      }
    });

    // Generate summary
    analysis.summary = this.generateSummary(analysis.metrics, activities.length);

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.patterns, type);

    return analysis;
  }

  private inferUnit(field: string): string {
    const fieldLower = field.toLowerCase();
    if (fieldLower.includes('distance')) return 'km';
    if (fieldLower.includes('duration')) return 'minutes';
    if (fieldLower.includes('speed')) return 'km/h';
    if (fieldLower.includes('weight')) return 'kg';
    if (fieldLower.includes('temperature')) return '°C';
    return '';
  }

  private generateSummary(metrics: AnalysisMetric[], totalCount: number): string[] {
    return [
      `Analysis based on ${totalCount} activities`,
      ...metrics
        .filter(m => m.type === 'numeric')
        .map(m => `Average ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`),
      ...metrics
        .filter(m => m.type === 'text')
        .map(m => `Most common ${m.name}: ${m.value}`)
    ];
  }

  private generateRecommendations(patterns: Record<string, any>, _type: string): string[] {
    const recommendations: string[] = [];
    
    Object.entries(patterns).forEach(([field, data]) => {
      if (typeof data === 'object' && 'avg' in data) {
        recommendations.push(
          `Consider maintaining ${field} around ${data.avg.toFixed(2)}${this.inferUnit(field)}, ` +
          `as this appears to be your optimal level`
        );
      } else if (typeof data === 'object') {
        const [bestPattern] = Object.entries(data)
          .sort((a, b) => (b[1] as number) - (a[1] as number));
        if (bestPattern) {
          recommendations.push(
            `Your most successful ${field} is "${bestPattern[0]}" - consider optimizing for this pattern`
          );
        }
      }
    });

    return recommendations;
  }

  private formatAnalysisResponse(analysis: ActivityAnalysis, _query: string): string {
    return `# Activity Analysis

## Overview
${analysis.summary.join('\n')}

## Key Metrics
${analysis.metrics
  .map(m => `• ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`)
  .join('\n')}

## Patterns Identified
${Object.entries(analysis.patterns)
  .map(([field, data]) => {
    if (typeof data === 'object' && 'avg' in data) {
      return `### ${field}
• Average: ${data.avg.toFixed(2)}${this.inferUnit(field)}
• Range: ${data.min.toFixed(2)} - ${data.max.toFixed(2)}${this.inferUnit(field)}`;
    } else {
      return `### ${field}
${Object.entries(data as Record<string, number>)
  .sort((a, b) => (b[1] as number) - (a[1] as number))
  .map(([value, count]) => `• ${value}: ${count} times`)
  .join('\n')}`;
    }
  })
  .join('\n\n')}

## Recommendations
${analysis.recommendations.map(r => `• ${r}`).join('\n')}`;
  }

  /**
   * Process a retrieval request using a swarm of agents
   */
  async processRetrievalRequest(
    query: string,
    userId: string,
    contextType?: string
  ): Promise<SwarmResult> {
    console.log('📝 Processing retrieval request:', { query, userId, contextType });

    // Create a swarm session for this request
    const session = await this.createRetrievalSwarm({
      userId,
      query,
      contextType,
      maxAgents: 3,
      timeoutSeconds: 30,
      analysisType: contextType
    });

    // Get the coordinator agent's context
    console.log('Getting context for coordinator agent:', session.coordinatorAgent);
    const context = await getAgentContext(session.coordinatorAgent, query);

    // Analyze the context data
    const analysis = this.analyzeActivities(
      context.map(c => {
        try {
          return typeof c.pageContent === 'string' ? 
            JSON.parse(c.pageContent) : c.pageContent;
        } catch {
          // If not JSON, try to parse structured text
          const lines = c.pageContent.split('\n');
          return lines.reduce((acc: Record<string, string>, line: string) => {
            const [key, value] = line.split(':').map(s => s.trim());
            if (key && value) acc[key] = value;
            return acc;
          }, {});
        }
      }),
      contextType || 'general'
    );

    const formattedText = this.formatAnalysisResponse(analysis, query);

    return {
      contentId: uuidv4(),
      userId: session.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      status: 'active',
      contentType: 'swarm_result',
      chunkIndex: 0,
      totalChunks: 1,
      isFirstChunk: true,
      access: 'personal',
      sharedWith: [],
      primaryCategory: 'analysis_result',
      secondaryCategories: [contextType || 'general'],
      tags: ['swarm_result', 'analysis', contextType || 'general'],
      title: `${contextType || 'Activity'} Analysis`,
      text: formattedText,
      summary: `Analysis of ${contextType || 'activity'} data based on ${analysis.summary[0]}`,
      searchableText: query,
      keywords: ['analysis', contextType || 'activity', 'patterns', 'metrics'],
      language: 'en',
      relatedIds: [session.sessionId],
      references: [],
      swarm: {
        agentId: session.coordinatorAgent,
        taskId: session.task.id,
        confidence: 0.95,
        resultType: 'final',
        performanceMetrics: {
          processingTime: Date.now() - session.createdAt,
          resourceUsage: 0,
          qualityScore: 0.95
        }
      }
    };
  }
} 