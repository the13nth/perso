import { AgentMetadata } from '@/lib/pinecone';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@clerk/nextjs/server';

// Get the base URL from environment or default to localhost in development
const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

interface AgentInsight {
  insight: string;
  evidence: string;
  confidence: number;
  category: string;
}

interface AgentResponse {
  insights: AgentInsight[];
  metadata: {
    responseTime: number;
    contextUsed: boolean;
    categoriesAnalyzed: string[];
    confidenceScore: number;
  };
  error?: string;
}

export interface AgentRunMetrics {
  agentId: string;
  runId: string;
  startTime: number;
  endTime?: number;
  successRate: number;
  totalRuns: number;
  averageResponseTime: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  error?: string;
  results: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
    output: AgentResponse;
    metrics: {
      contextRelevance: number;
      insightQuality: number;
      responseLatency: number;
    };
  }>;
}

export interface AgentChainResult {
  metrics: Record<string, AgentRunMetrics>;
  totalRuns: number;
  overallSuccess: number;
  activeAgents: number;
  insights: Array<{
    agentName: string;
    category: string;
    insights: AgentInsight[];
    performance: {
      contextRelevance: number;
      insightQuality: number;
      responseLatency: number;
    };
    metadata: {
      responseTime: number;
      contextUsed: boolean;
      categoriesAnalyzed: string[];
      confidenceScore: number;
    };
  }>;
  performance: {
    contextRelevance: number;
    insightQuality: number;
    responseLatency: number;
    categoryCoverage: number;
    successRate: number;
  };
}

class AgentRunnerService {
  private metricsRef = adminDb.collection('agentMetrics');
  private runningAgents: Set<string> = new Set();

  private calculateMetrics(response: AgentResponse): {
    contextRelevance: number;
    insightQuality: number;
    responseLatency: number;
  } {
    // Calculate context relevance based on evidence quality and metadata
    const evidenceQuality = response.insights?.reduce((sum, insight) => {
      // Check if evidence is substantial (not empty or too short)
      const hasSubstantialEvidence = insight.evidence && insight.evidence.length > 20;
      // Check if evidence contains specific data points or quotes
      const hasSpecificData = /\d+|"[^"]+"|'[^']+'/.test(insight.evidence);
      // Check if evidence matches the insight's category
      const matchesCategory = insight.evidence.toLowerCase().includes(insight.category.toLowerCase());
      
      return sum + (hasSubstantialEvidence ? 0.4 : 0) + 
                  (hasSpecificData ? 0.4 : 0) + 
                  (matchesCategory ? 0.2 : 0);
    }, 0) / (response.insights?.length || 1);

    const contextRelevance = Math.min(1, evidenceQuality + 
      (response.metadata?.contextUsed ? 0.2 : 0) + 
      (response.metadata?.categoriesAnalyzed?.length ? 0.2 : 0));

    // Calculate insight quality based on multiple factors
    const insightQuality = response.insights?.reduce((sum, insight) => {
      // Base confidence score (0-1)
      const confidenceScore = Math.min(1, (insight.confidence || 0) / 100);
      
      // Check insight specificity
      const isSpecific = insight.insight.length > 30 && /\d+|%|\$|€|£/.test(insight.insight);
      
      // Check if insight is actionable
      const isActionable = /should|could|recommend|suggest|improve|increase|decrease|optimize/.test(insight.insight.toLowerCase());
      
      // Check if insight has clear category alignment
      const hasCategoryAlignment = insight.category && insight.insight.toLowerCase().includes(insight.category.toLowerCase());
      
      return sum + (confidenceScore * 0.4) + 
                  (isSpecific ? 0.3 : 0) + 
                  (isActionable ? 0.2 : 0) + 
                  (hasCategoryAlignment ? 0.1 : 0);
    }, 0) / (response.insights?.length || 1);

    // Calculate response latency score (1 is best, 0 is worst)
    // Expect responses within 15 seconds, penalize longer times
    const responseTime = response.metadata?.responseTime || 15000;
    const responseLatency = Math.max(0, Math.min(1, 15000 / responseTime));

    return {
      contextRelevance,
      insightQuality,
      responseLatency
    };
  }

  private async initializeMetrics(agent: AgentMetadata): Promise<AgentRunMetrics> {
    const runId = uuidv4();
    const metrics: AgentRunMetrics = {
      agentId: agent.agentId,
      runId,
      startTime: Date.now(),
      successRate: 0,
      totalRuns: 0,
      averageResponseTime: 0,
      status: 'running',
      results: []
    };

    await this.metricsRef.doc(runId).set(this.convertMetricsForFirestore(metrics));
    return metrics;
  }

  private convertMetricsForFirestore(metrics: AgentRunMetrics): any {
    return {
      ...metrics,
      results: metrics.results.map(r => ({
        ...r,
        output: r.output ? JSON.parse(JSON.stringify(r.output)) : null
      }))
    };
  }

  private async updateMetrics(metrics: AgentRunMetrics) {
    await this.metricsRef.doc(metrics.runId).set(
      this.convertMetricsForFirestore(metrics),
      { merge: true }
    );
  }

  private validateAgentResponse(response: any): AgentResponse {
    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format: Response must be an object');
    }

    // Ensure insights array exists and has correct format
    if (!Array.isArray(response.insights)) {
      response.insights = [];
    }

    // Validate each insight
    response.insights = response.insights.map((insight: { 
      insight?: string | number | boolean; 
      evidence?: string | number | boolean;
      confidence?: string | number;
      category?: string | number | boolean;
    }) => ({
      insight: String(insight.insight || ''),
      evidence: String(insight.evidence || ''),
      confidence: Number(insight.confidence || 0),
      category: String(insight.category || 'general')
    }));

    // Ensure metadata exists with correct format
    if (!response.metadata || typeof response.metadata !== 'object') {
      response.metadata = {
        responseTime: Date.now(),
        contextUsed: false,
        categoriesAnalyzed: [],
        confidenceScore: 0
      };
    } else {
      response.metadata = {
        responseTime: Number(response.metadata.responseTime || Date.now()),
        contextUsed: Boolean(response.metadata.contextUsed),
        categoriesAnalyzed: Array.isArray(response.metadata.categoriesAnalyzed) ? 
          response.metadata.categoriesAnalyzed.map(String) : [],
        confidenceScore: Number(response.metadata.confidenceScore || 0)
      };
    }

    return response as AgentResponse;
  }

  private async executeAgent(agent: AgentMetadata): Promise<AgentRunMetrics> {
    const metrics = await this.initializeMetrics(agent);
    this.runningAgents.add(agent.agentId);

    try {
      // Validate agent configuration
      if (!agent.agentId || !agent.name) {
        throw new Error('Invalid agent configuration: Missing required fields');
      }

      // Get auth session
      const session = await auth();
      if (!session?.userId) {
        throw new Error('No authenticated user found');
      }

      // Get auth token
      const authToken = await session.getToken();

      // Validate agent access
      const agentResponse = await fetch(`${BASE_URL}/api/agents/${agent.agentId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!agentResponse.ok) {
        throw new Error(`Failed to validate agent access: ${agentResponse.status} ${agentResponse.statusText}`);
      }

      const agentConfig = await agentResponse.json();
      if (!agentConfig || agentConfig.error) {
        throw new Error('Invalid agent configuration or access denied');
      }

      // Execute the agent's main task using absolute URL
      const response = await fetch(`${BASE_URL}/api/agents/${agent.agentId}/questions/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          question: "Use your provided categories context to generate 3 insights from your data",
          context: {
            type: 'chain_execution',
            timestamp: Date.now(),
            requireInsights: true,
            format: {
              type: 'insights',
              count: 3,
              requireEvidence: true,
              categories: agent.selectedContextIds || []
            }
          }
        })
      });

      let result: AgentResponse;
      const responseText = await response.text();

      try {
        const parsedResponse = JSON.parse(responseText);
        // Validate and normalize the response
        result = this.validateAgentResponse(parsedResponse);
      } catch (parseError) {
        // If response is not JSON, check if it's an HTML error page
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          console.error(`Agent ${agent.agentId} returned HTML instead of JSON. Status: ${response.status}`);
          throw new Error(`Agent returned invalid response format (HTML). Status: ${response.status}`);
        } else {
          console.error(`Agent ${agent.agentId} returned invalid JSON:`, responseText);
          throw new Error('Invalid JSON response from agent');
        }
      }

      if (!response.ok) {
        throw new Error(`Agent execution failed: ${response.status} ${response.statusText}`);
      }

      // Calculate performance metrics
      const performanceMetrics = this.calculateMetrics(result);
      
      // Update metrics with the execution result
      const executionTime = Date.now() - metrics.startTime;
      metrics.results.push({
        timestamp: Date.now(),
        success: true,
        responseTime: executionTime,
        output: result,
        metrics: performanceMetrics
      });

      // Calculate updated metrics
      metrics.totalRuns++;
      metrics.successRate = (metrics.results.filter(r => r.success).length / metrics.results.length) * 100;
      metrics.averageResponseTime = metrics.results.reduce((sum, r) => sum + r.responseTime, 0) / metrics.results.length;
      metrics.status = 'completed';
      metrics.endTime = Date.now();

      return metrics;
    } catch (error) {
      console.error(`Error executing agent ${agent.agentId}:`, error);
      metrics.status = 'error';
      metrics.error = error instanceof Error ? error.message : 'Unknown error';
      metrics.endTime = Date.now();
      
      // Add the failed attempt to results with proper error response format
      metrics.results.push({
        timestamp: Date.now(),
        success: false,
        responseTime: Date.now() - metrics.startTime,
        output: {
          insights: [],
          metadata: {
            responseTime: Date.now() - metrics.startTime,
            contextUsed: false,
            categoriesAnalyzed: [],
            confidenceScore: 0
          },
          error: metrics.error
        },
        metrics: {
          contextRelevance: 0,
          insightQuality: 0,
          responseLatency: 0
        }
      });
      
      return metrics;
    } finally {
    this.runningAgents.delete(agent.agentId);
    await this.updateMetrics(metrics);
    }
  }

  async launchAgentChain(agents: AgentMetadata[]): Promise<AgentChainResult> {
    const metrics: Record<string, AgentRunMetrics> = {};
    let totalSuccessful = 0;
    const insights: Array<{
      agentName: string;
      category: string;
      insights: AgentInsight[];
      performance: {
        contextRelevance: number;
        insightQuality: number;
        responseLatency: number;
      };
      metadata: {
        responseTime: number;
        contextUsed: boolean;
        categoriesAnalyzed: string[];
        confidenceScore: number;
      };
    }> = [];

    // Execute agents in sequence
    for (const agent of agents) {
      const agentMetrics = await this.executeAgent(agent);
      metrics[agent.agentId] = agentMetrics;
      
      if (agentMetrics.status === 'completed') {
        totalSuccessful++;
        
        // Extract insights and performance metrics from the agent's response
        if (agentMetrics.results.length > 0) {
          const latestResult = agentMetrics.results[agentMetrics.results.length - 1];
          if (latestResult.output?.insights) {
            insights.push({
              agentName: String(agent.name || agent.agentId),
              category: String(agent.primaryCategory || 'General'),
              insights: latestResult.output.insights,
              performance: latestResult.metrics,
              metadata: latestResult.output.metadata
            });
          }
        }
      }
    }

    // Calculate overall chain metrics
    const totalRuns = Object.values(metrics).reduce((sum, m) => sum + m.totalRuns, 0);
    const overallSuccess = (totalSuccessful / agents.length) * 100;
    
    // Calculate aggregate performance metrics
    const aggregatePerformance = insights.reduce((agg, current) => ({
      contextRelevance: agg.contextRelevance + (current.performance.contextRelevance || 0),
      insightQuality: agg.insightQuality + (current.performance.insightQuality || 0),
      responseLatency: agg.responseLatency + (current.performance.responseLatency || 0)
    }), { contextRelevance: 0, insightQuality: 0, responseLatency: 0 });

    const averagePerformance = insights.length ? {
      contextRelevance: aggregatePerformance.contextRelevance / insights.length,
      insightQuality: aggregatePerformance.insightQuality / insights.length,
      responseLatency: aggregatePerformance.responseLatency / insights.length
    } : { contextRelevance: 0, insightQuality: 0, responseLatency: 0 };

    // Calculate category coverage
    const uniqueCategories = new Set(
      insights.flatMap(i => i.metadata.categoriesAnalyzed)
    ).size;

    return {
      metrics,
      totalRuns,
      overallSuccess,
      activeAgents: this.runningAgents.size,
      insights,
      performance: {
        ...averagePerformance,
        categoryCoverage: uniqueCategories / agents.length,
        successRate: overallSuccess / 100
      }
    };
  }

  async getAgentMetrics(agentId: string): Promise<AgentRunMetrics[]> {
    const snapshot = await this.metricsRef
      .where('agentId', '==', agentId)
      .orderBy('startTime', 'desc')
      .limit(10)
      .get();

    return snapshot.docs.map(doc => doc.data() as AgentRunMetrics);
  }

  isAgentRunning(agentId: string): boolean {
    return this.runningAgents.has(agentId);
  }
}

export const agentRunner = new AgentRunnerService(); 