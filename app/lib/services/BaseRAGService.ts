import { Message } from 'ai';

export interface RAGResponse {
  success: boolean;
  response: string;
  agentId: string;
  contextUsed: number;
  relevanceScores: Array<{
    source: string;
    score: number;
  }>;
}

export interface BaseRAGService {
  generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse>;
} 