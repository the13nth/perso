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
  /**
   * Optional list of the top retrieved context documents (up to 10) that were
   * used when generating the response. Each item contains a short content
   * preview, the original source identifier, the similarity score and the
   * content category. This can be displayed in the UI beneath the assistant
   * answer to give users additional transparency about the information
   * grounding the response.
   */
  closestMatches?: Array<{
    /** First ~200 characters of the document */
    contentPreview: string;
    /** Document source identifier (e.g. filename, URL) */
    source: string;
    /** Vector similarity score */
    score: number;
    /** Category/context label */
    category: string;
  }>;
}

export interface BaseRAGService {
  generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse>;
} 