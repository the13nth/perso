import { Message } from 'ai';

export interface RAGResponse {
  success: boolean;
  response: string;
  agentId: string;
  contextUsed: number;
  results: Array<{
    timestamp: number;
    success: boolean;
    responseTime: number;
    output: {
      insights: Array<{
        insight: string;
        evidence: string;
        confidence: number;
        category: string;
      }>;
      metadata: {
        responseTime: number;
        contextUsed: boolean;
        categoriesAnalyzed: string[];
        confidenceScore: number;
      };
    };
    metrics: {
      contextRelevance: number;
      insightQuality: number;
      responseLatency: number;
    };
  }>;
  relevanceScores: Array<{
    source: string;
    score: number;
    category: string;
  }>;
  categoryContexts: Array<{
    category: string;
    count: number;
    relevantCount: number;
  }>;
}

export interface BaseRAGService {
  generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse>;
} 