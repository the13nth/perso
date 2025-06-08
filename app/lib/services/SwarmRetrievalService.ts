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
    // Initialize analysis structure
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

    // Track temporal patterns
    const temporalPatterns: Record<string, any> = {};
    
    // Analyze temporal patterns for each field
    fields.forEach(field => {
      if (activities.length > 1) {
        const values = activities.map(a => a[field]);
        const timeBasedChanges = [];
        
        for (let i = 1; i < values.length; i++) {
          const prev = values[i - 1];
          const curr = values[i];
          
          if (typeof curr === 'number' && typeof prev === 'number') {
            timeBasedChanges.push({
              change: curr - prev,
              percentChange: ((curr - prev) / prev) * 100
            });
          }
        }
        
        if (timeBasedChanges.length > 0) {
          temporalPatterns[field] = {
            averageChange: timeBasedChanges.reduce((sum, c) => sum + c.change, 0) / timeBasedChanges.length,
            averagePercentChange: timeBasedChanges.reduce((sum, c) => sum + c.percentChange, 0) / timeBasedChanges.length,
            trend: this.detectTrend(values.filter(v => typeof v === 'number')),
            consistency: this.calculateConsistency(timeBasedChanges.map(c => c.change))
          };
        }
      }
    });
    
    // Add temporal patterns to analysis if found
    if (Object.keys(temporalPatterns).length > 0) {
      analysis.patterns['temporal'] = temporalPatterns;
    }
    
    // Track correlations between numeric fields
    const correlations: Record<string, Record<string, number>> = {};
    
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
        const median = numbers.sort((a, b) => a - b)[Math.floor(numbers.length / 2)];
        
        // Calculate standard deviation
        const variance = numbers.reduce((sum, n) => sum + Math.pow(n - avg, 2), 0) / numbers.length;
        const stdDev = Math.sqrt(variance);
        
        // Detect trends
        const trend = this.detectTrend(numbers);
        
        analysis.metrics.push({
          name: field,
          value: avg.toFixed(2),
          type: 'numeric',
          unit: this.inferUnit(field)
        });

        analysis.patterns[field] = { 
          min, 
          max, 
          avg,
          median,
          stdDev,
          trend,
          distribution: this.calculateDistribution(numbers)
        };
        
        // Calculate correlations with other numeric fields
        fields.forEach(otherField => {
          if (otherField !== field && activities[0][otherField] !== undefined && 
              (typeof activities[0][otherField] === 'number' || !isNaN(parseFloat(activities[0][otherField])))) {
            const otherNumbers = activities.map(a => parseFloat(a[otherField]));
            const correlation = this.calculateCorrelation(numbers, otherNumbers);
            
            if (!correlations[field]) correlations[field] = {};
            correlations[field][otherField] = correlation;
          }
        });
      }
      // Status/category analysis
      else if (typeof values[0] === 'string') {
        const frequency = values.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const [mostCommon] = Object.entries(frequency)
          .sort((a, b) => (b[1] as number) - (a[1] as number));
        
        // Check if field might be a status
        const isStatus = field.toLowerCase().includes('status') || 
                        values.every(v => ['completed', 'pending', 'in_progress', 'failed', 'success'].includes(v.toLowerCase()));
        
        // Check if field might be a duration
        const isDuration = field.toLowerCase().includes('duration') || 
                          field.toLowerCase().includes('time') ||
                          values.every(v => /^\d+\s*(min|hour|day|sec)/i.test(v));

        analysis.metrics.push({
          name: field,
          value: mostCommon[0],
          type: isStatus ? 'status' : isDuration ? 'duration' : 'text'
        });

        analysis.patterns[field] = frequency;
        
        // Analyze transitions (if status field)
        if (isStatus) {
          const transitions = this.analyzeStatusTransitions(activities, field);
          analysis.patterns[`${field}_transitions`] = transitions;
        }
      }
    });

    // Add correlation analysis to patterns if significant correlations found
    const significantCorrelations = Object.entries(correlations)
      .reduce((acc, [field, correlations]) => {
        const significant = Object.entries(correlations)
          .filter(([_, value]) => Math.abs(value) > 0.5)
          .map(([otherField, value]) => ({
            fields: [field, otherField],
            strength: value
          }));
        return [...acc, ...significant];
      }, [] as Array<{fields: string[], strength: number}>);

    if (significantCorrelations.length > 0) {
      analysis.patterns['correlations'] = significantCorrelations;
    }

    // Generate comprehensive summary
    analysis.summary = this.generateEnhancedSummary(analysis.metrics, activities.length, analysis.patterns);

    // Generate intelligent recommendations
    analysis.recommendations = this.generateEnhancedRecommendations(analysis.patterns, type, significantCorrelations);

    return analysis;
  }

  private detectTrend(numbers: number[]): 'increasing' | 'decreasing' | 'stable' | 'fluctuating' {
    if (numbers.length < 2) return 'stable';
    
    let increasingCount = 0;
    let decreasingCount = 0;
    
    for (let i = 1; i < numbers.length; i++) {
        if (numbers[i] > numbers[i-1]) increasingCount++;
        else if (numbers[i] < numbers[i-1]) decreasingCount++;
    }
    
    const total = numbers.length - 1;
    const increasingRatio = increasingCount / total;
    const decreasingRatio = decreasingCount / total;
    
    if (increasingRatio > 0.7) return 'increasing';
    if (decreasingRatio > 0.7) return 'decreasing';
    if (increasingRatio < 0.3 && decreasingRatio < 0.3) return 'stable';
    return 'fluctuating';
  }

  private calculateDistribution(numbers: number[]): Record<string, number> {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const range = max - min;
    const bucketSize = range / 5; // Split into 5 buckets
    
    const distribution: Record<string, number> = {};
    
    for (let i = 0; i < 5; i++) {
        const bucketMin = min + (bucketSize * i);
        const bucketMax = bucketMin + bucketSize;
        const bucketLabel = `${bucketMin.toFixed(1)}-${bucketMax.toFixed(1)}`;
        
        distribution[bucketLabel] = numbers.filter(n => n >= bucketMin && n < bucketMax).length;
    }
    
    return distribution;
  }

  private calculateCorrelation(array1: number[], array2: number[]): number {
    const n = Math.min(array1.length, array2.length);
    if (n < 2) return 0;

    const mean1 = array1.reduce((a, b) => a + b, 0) / n;
    const mean2 = array2.reduce((a, b) => a + b, 0) / n;

    const variance1 = array1.reduce((a, b) => a + Math.pow(b - mean1, 2), 0) / n;
    const variance2 = array2.reduce((a, b) => a + Math.pow(b - mean2, 2), 0) / n;

    const covariance = array1
        .slice(0, n)
        .reduce((a, b, i) => a + (b - mean1) * (array2[i] - mean2), 0) / n;

    return covariance / Math.sqrt(variance1 * variance2);
  }

  private analyzeStatusTransitions(activities: any[], field: string): Record<string, Record<string, number>> {
    const transitions: Record<string, Record<string, number>> = {};
    
    for (let i = 1; i < activities.length; i++) {
        const fromStatus = activities[i-1][field];
        const toStatus = activities[i][field];
        
        if (!transitions[fromStatus]) transitions[fromStatus] = {};
        transitions[fromStatus][toStatus] = (transitions[fromStatus][toStatus] || 0) + 1;
    }
    
    return transitions;
  }

  private generateEnhancedSummary(metrics: AnalysisMetric[], totalCount: number, patterns: Record<string, any>): string[] {
    const summary = [`Analysis based on ${totalCount} activities`];
    
    // Add metric summaries
    metrics.forEach(m => {
        if (m.type === 'numeric') {
            const pattern = patterns[m.name];
            const trend = pattern.trend;
            const trendEmoji = trend === 'increasing' ? '📈' : 
                             trend === 'decreasing' ? '📉' : 
                             trend === 'stable' ? '➡️' : '↕️';
            
            summary.push(`${trendEmoji} ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''} (trend: ${trend})`);
        } else if (m.type === 'status') {
            summary.push(`🎯 Most common ${m.name}: ${m.value}`);
        }
    });
    
    // Add correlation insights
    if (patterns.correlations) {
        patterns.correlations.forEach((corr: {fields: string[], strength: number}) => {
            const [field1, field2] = corr.fields;
            const relationship = corr.strength > 0 ? 'increases' : 'decreases';
            summary.push(`🔄 When ${field1} increases, ${field2} typically ${relationship}`);
        });
    }
    
    return summary;
  }

  private generateEnhancedRecommendations(
    patterns: Record<string, any>, 
    type: string,
    correlations: Array<{fields: string[], strength: number}>
): string[] {
    const recommendations: string[] = [];
    
    // Add type-specific recommendations
    switch (type.toLowerCase()) {
        case 'running':
        case 'workout':
            this.addFitnessRecommendations(patterns, recommendations);
            break;
        case 'productivity':
        case 'work':
            this.addProductivityRecommendations(patterns, recommendations);
            break;
        case 'financial':
        case 'finance':
            this.addFinancialRecommendations(patterns, recommendations);
            break;
    }
    
    // Add general pattern-based recommendations
    Object.entries(patterns).forEach(([field, data]) => {
        if (typeof data === 'object' && 'trend' in data) {
            const trend = data.trend;
            if (trend === 'decreasing' && !field.toLowerCase().includes('negative')) {
                recommendations.push(
                    `📊 Consider strategies to improve ${field} which shows a decreasing trend`
                );
            } else if (trend === 'fluctuating') {
                recommendations.push(
                    `📈 Work on maintaining more consistent ${field} levels`
                );
            }
        }
    });
    
    // Add correlation-based recommendations
    correlations.forEach(corr => {
        if (Math.abs(corr.strength) > 0.7) {
            recommendations.push(
                `🔄 Strong relationship found between ${corr.fields[0]} and ${corr.fields[1]} - consider optimizing them together`
            );
        }
    });
    
    return recommendations;
}

private addFitnessRecommendations(patterns: Record<string, any>, recommendations: string[]): void {
    if (patterns.distance?.trend === 'increasing') {
        recommendations.push('🏃‍♂️ Great progress on distance! Consider increasing intensity next');
    }
    if (patterns.duration?.avg > 60) {
        recommendations.push('⏱️ Your workouts are quite long - focus on intensity over duration');
    }
    if (patterns.intensity?.trend === 'stable') {
        recommendations.push('💪 Try varying your intensity levels to improve overall fitness');
    }
}

private addProductivityRecommendations(patterns: Record<string, any>, recommendations: string[]): void {
    if (patterns.duration?.distribution) {
        const longSessions = Object.entries(patterns.duration.distribution)
            .filter(([range, _count]) => parseFloat(range.split('-')[1]) > 120)
            .reduce((sum, [_, count]) => sum + (count as number), 0);
        
        if (longSessions > 0) {
            recommendations.push('⏰ Consider breaking long sessions into shorter, focused intervals');
        }
    }
    if (patterns.energy_level?.trend === 'decreasing') {
        recommendations.push('🔋 Energy levels are declining - consider adjusting your work schedule or taking more breaks');
    }
}

private addFinancialRecommendations(patterns: Record<string, any>, recommendations: string[]): void {
    if (patterns.spending?.trend === 'increasing') {
        recommendations.push('💰 Spending is trending up - review your budget and identify areas for optimization');
    }
    if (patterns.savings?.trend === 'decreasing') {
        recommendations.push('🏦 Consider automating savings to maintain a consistent saving pattern');
    }
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

  private formatAnalysisResponse(analysis: ActivityAnalysis, query: string): string {
    // Group metrics by type for better organization
    const numericMetrics = analysis.metrics.filter(m => m.type === 'numeric');
    const statusMetrics = analysis.metrics.filter(m => m.type === 'status');
    const durationMetrics = analysis.metrics.filter(m => m.type === 'duration');
    const textMetrics = analysis.metrics.filter(m => m.type === 'text');

    // Format sections with appropriate emojis
    const sections = [
      // Overview section
      `# 📊 Activity Analysis\n`,
      
      // Query context
      query ? `## 🔍 Analysis Context\nQuery: "${query}"\n` : '',
      
      // Summary section with key findings
      `## 📝 Summary\n${analysis.summary.map(s => `• ${s}`).join('\n')}\n`,
      
      // Metrics sections by type
      numericMetrics.length > 0 ? 
        `## 📈 Numeric Metrics\n${numericMetrics.map(m => 
          `• ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`
        ).join('\n')}\n` : '',
      
      statusMetrics.length > 0 ?
        `## 🎯 Status Metrics\n${statusMetrics.map(m =>
          `• ${m.name}: ${m.value}`
        ).join('\n')}\n` : '',
      
      durationMetrics.length > 0 ?
        `## ⏱️ Duration Metrics\n${durationMetrics.map(m =>
          `• ${m.name}: ${m.value}${m.unit ? ` ${m.unit}` : ''}`
        ).join('\n')}\n` : '',
      
      textMetrics.length > 0 ?
        `## 📋 Other Metrics\n${textMetrics.map(m =>
          `• ${m.name}: ${m.value}`
        ).join('\n')}\n` : '',
      
      // Patterns section with detailed analysis
      Object.keys(analysis.patterns).length > 0 ? 
        `## 🔄 Patterns Identified\n${Object.entries(analysis.patterns).map(([field, data]) => {
          if (typeof data === 'object' && 'avg' in data) {
            return `### ${field}\n` +
              `• Average: ${data.avg.toFixed(2)}${this.inferUnit(field)}\n` +
              `• Range: ${data.min.toFixed(2)} - ${data.max.toFixed(2)}${this.inferUnit(field)}`;
          } else {
            const sortedEntries = Object.entries(data as Record<string, number>)
              .sort((a, b) => (b[1] as number) - (a[1] as number));
            const total = sortedEntries.reduce((sum, [_, count]) => sum + count, 0);
            
            return `### ${field}\n${sortedEntries.map(([value, _count]) => 
              `• ${value}: ${_count} times (${((_count / total) * 100).toFixed(1)}%)`
            ).join('\n')}`;
          }
        }).join('\n\n')}\n` : '',
      
      // Recommendations section
      analysis.recommendations.length > 0 ?
        `## 💡 Recommendations\n${analysis.recommendations.map(r => 
          `• ${r}`
        ).join('\n')}\n` : ''
    ];

    // Filter out empty sections and join
    return sections.filter(Boolean).join('\n');
  }

  /**
   * Process a retrieval request using a swarm of agents
   */
  async processRetrievalRequest(
    query: string,
    userId: string,
    contextType?: string
  ): Promise<SwarmResult> {
    try {
      // Input validation
      if (!query.trim()) {
        throw new Error('Query cannot be empty');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }
      if (query.length > 1000) {
        throw new Error('Query exceeds maximum length of 1000 characters');
      }

      console.log('📝 Processing retrieval request:', { query, userId, contextType });

      // Create a swarm session for this request
      let session: SwarmSession;
      try {
        session = await this.createRetrievalSwarm({
          userId,
          query,
          contextType,
          maxAgents: 3,
          timeoutSeconds: 30,
          analysisType: contextType
        });
      } catch (error) {
        console.error('Failed to create swarm session:', error);
        throw new Error('Failed to initialize swarm session');
      }

      // Get the coordinator agent's context
      console.log('Getting context for coordinator agent:', session.coordinatorAgent);
      let context;
      try {
        context = await getAgentContext(session.coordinatorAgent, query);
        
        if (!context || context.length === 0) {
          console.warn('No context found for query, using fallback analysis');
          context = [{ pageContent: JSON.stringify({
            status: 'no_data',
            message: 'No relevant data found for the query',
            timestamp: new Date().toISOString()
          })}];
        }
      } catch (error) {
        console.error('Failed to get agent context:', error);
        throw new Error('Failed to retrieve context data');
      }

      // Analyze the context data
      let analysis: ActivityAnalysis;
      try {
        analysis = this.analyzeActivities(
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

        // Validate analysis results
        if (!analysis.metrics || analysis.metrics.length === 0) {
          console.warn('No metrics found in analysis, adding default metrics');
          analysis.metrics = [{
            name: 'data_points',
            value: context.length,
            type: 'numeric'
          }];
        }

        if (!analysis.summary || analysis.summary.length === 0) {
          console.warn('No summary found in analysis, adding default summary');
          analysis.summary = [`Analysis based on ${context.length} data points`];
        }
      } catch (error) {
        console.error('Failed to analyze context data:', error);
        throw new Error('Failed to analyze retrieved data');
      }

      // Format the analysis response
      let formattedText: string;
      try {
        formattedText = this.formatAnalysisResponse(analysis, query);
        
        if (!formattedText || formattedText.trim().length === 0) {
          console.warn('Empty formatted text, using fallback format');
          formattedText = `# Analysis Results\n\nNo detailed analysis available for the query: "${query}"\n\nPlease try refining your query or providing more context.`;
        }
      } catch (error) {
        console.error('Failed to format analysis response:', error);
        throw new Error('Failed to format analysis results');
      }

      // Create the final result
      const result: SwarmResult = {
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
          confidence: this.calculateConfidenceScore(analysis),
          resultType: 'final',
          performanceMetrics: {
            processingTime: Date.now() - session.createdAt,
            resourceUsage: 0,
            qualityScore: this.calculateQualityScore(analysis)
          }
        }
      };

      return result;
    } catch (error) {
      // Log the error with full context
      console.error('Error in processRetrievalRequest:', {
        error,
        query,
        userId,
        contextType,
        timestamp: new Date().toISOString()
      });

      // Rethrow with a user-friendly message
      throw new Error(
        error instanceof Error ? 
          `Failed to process retrieval request: ${error.message}` : 
          'An unexpected error occurred while processing the request'
      );
    }
  }

  private calculateConfidenceScore(analysis: ActivityAnalysis): number {
    let score = 0.7; // Base confidence score

    // Adjust based on metrics
    if (analysis.metrics.length > 0) {
      score += Math.min(0.1, analysis.metrics.length * 0.02); // Up to +0.1 for metrics
    }

    // Adjust based on patterns
    const patternCount = Object.keys(analysis.patterns).length;
    if (patternCount > 0) {
      score += Math.min(0.1, patternCount * 0.02); // Up to +0.1 for patterns
    }

    // Adjust based on recommendations
    if (analysis.recommendations.length > 0) {
      score += Math.min(0.1, analysis.recommendations.length * 0.02); // Up to +0.1 for recommendations
    }

    return Math.min(0.95, score); // Cap at 0.95
  }

  private calculateQualityScore(analysis: ActivityAnalysis): number {
    let score = 0.7; // Base quality score

    // Check for comprehensive analysis
    if (analysis.metrics.length >= 3) score += 0.1;
    if (Object.keys(analysis.patterns).length >= 2) score += 0.1;
    if (analysis.recommendations.length >= 2) score += 0.1;

    // Check for data quality
    const numericMetrics = analysis.metrics.filter(m => m.type === 'numeric').length;
    if (numericMetrics > 0) score += 0.05;

    // Check for meaningful patterns
    if (analysis.patterns.correlations?.length > 0) score += 0.05;

    return Math.min(0.95, score); // Cap at 0.95
  }

  private calculateConsistency(changes: number[]): 'high' | 'medium' | 'low' {
    if (changes.length < 2) return 'high';
    
    // Calculate standard deviation of changes
    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate coefficient of variation (CV)
    const cv = Math.abs(stdDev / mean);
    
    // Classify consistency based on CV
    if (cv < 0.1) return 'high';
    if (cv < 0.3) return 'medium';
    return 'low';
  }
} 