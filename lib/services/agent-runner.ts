import { AgentMetadata } from '@/lib/pinecone';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@clerk/nextjs/server';

// Get the base URL from environment or default to localhost in development
const BASE_URL = process.env.NEXT_PUBLIC_VERCEL_URL 
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` 
  : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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
    output: any;
  }>;
}

export interface AgentChainResult {
  metrics: Record<string, AgentRunMetrics>;
  totalRuns: number;
  overallSuccess: number;
  activeAgents: number;
}

class AgentRunnerService {
  private metricsRef = adminDb.collection('agentMetrics');
  private runningAgents: Set<string> = new Set();

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

    // Convert the metrics object to a plain object for Firestore
    const firestoreData = {
      ...metrics,
      results: metrics.results.map(r => ({ ...r }))
    };

    await this.metricsRef.doc(runId).set(firestoreData);
    return metrics;
  }

  private async updateMetrics(metrics: AgentRunMetrics) {
    // Convert the metrics object to a plain object for Firestore
    const firestoreData = {
      ...metrics,
      results: metrics.results.map(r => ({ ...r }))
    };

    await this.metricsRef.doc(metrics.runId).set(firestoreData, { merge: true });
  }

  private async executeAgent(agent: AgentMetadata): Promise<AgentRunMetrics> {
    const metrics = await this.initializeMetrics(agent);
    this.runningAgents.add(agent.agentId);

    try {
      // Get auth session
      const session = await auth();
      if (!session?.userId) {
        throw new Error('No authenticated user found');
      }

      // Get auth token
      const authToken = await session.getToken();

      // Execute the agent's main task using absolute URL
      const response = await fetch(`${BASE_URL}/api/agents/${agent.agentId}/questions/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          question: "What tasks can you help me with?",
          context: {
            type: 'chain_execution',
            timestamp: Date.now()
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Agent execution failed: ${response.status} ${response.statusText}\n${errorText}`);
      }

      const result = await response.json();
      
      // Update metrics with the execution result
      const executionTime = Date.now() - metrics.startTime;
      metrics.results.push({
        timestamp: Date.now(),
        success: true,
        responseTime: executionTime,
        output: result
      });

      // Calculate updated metrics
      metrics.totalRuns++;
      metrics.successRate = (metrics.results.filter(r => r.success).length / metrics.results.length) * 100;
      metrics.averageResponseTime = metrics.results.reduce((sum, r) => sum + r.responseTime, 0) / metrics.results.length;
      metrics.status = 'completed';
      metrics.endTime = Date.now();

    } catch (error) {
      console.error(`Error executing agent ${agent.agentId}:`, error);
      metrics.status = 'error';
      metrics.error = error instanceof Error ? error.message : 'Unknown error';
      metrics.endTime = Date.now();
    }

    this.runningAgents.delete(agent.agentId);
    await this.updateMetrics(metrics);
    return metrics;
  }

  async launchAgentChain(agents: AgentMetadata[]): Promise<AgentChainResult> {
    const metrics: Record<string, AgentRunMetrics> = {};
    let totalSuccessful = 0;

    // Execute agents in sequence
    for (const agent of agents) {
      const agentMetrics = await this.executeAgent(agent);
      metrics[agent.agentId] = agentMetrics;
      if (agentMetrics.status === 'completed') {
        totalSuccessful++;
      }
    }

    // Calculate overall chain metrics
    const totalRuns = Object.values(metrics).reduce((sum, m) => sum + m.totalRuns, 0);
    const overallSuccess = (totalSuccessful / agents.length) * 100;

    return {
      metrics,
      totalRuns,
      overallSuccess,
      activeAgents: this.runningAgents.size
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