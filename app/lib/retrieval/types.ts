import { ContentType } from '../content/types';
import { z } from 'zod';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface DocumentInput {
  id: string;
  content: string;
  metadata: {
    categories?: string[];
    access?: 'public' | 'personal';
    source?: string;
    uploadedAt?: string;
    processingStartedAt?: string;
    contentType?: ContentType;
    originalFileName?: string;
    fileType?: string;
    fileSize?: number;
    extractedAt?: string;
    [key: string]: any;
  };
  type: ContentType;
  userId: string;
}

export interface FirestoreDocument {
  id: string;
  userId: string;
  content: string;
  metadata: DocumentInput['metadata'];
  type: ContentType;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface Category {
  id: string;
  name: string;
  weight: number;
  description?: string;
  parentId?: string;
  embedding?: number[];
}

export interface ContextChunk {
  content: string;
  categoryId: string;
  embedding?: number[];
  relevanceScore?: number;
}

export interface ContextRequest {
  query: string;
  maxChunks: number;
  minRelevance: number;
  includeRelatedCategories: boolean;
}

export interface ContextResponse {
  chunks: ContextChunk[];
  categories: Category[];
  metadata?: Record<string, unknown>;
}

export interface ContextOptimizer {
  optimizeContext(chunks: ContextChunk[], request: ContextRequest): Promise<ContextChunk[]>;
}

export interface CategoryService {
  getCategory(id: string): Promise<Category | null>;
  getRelatedCategories(categoryId: string): Promise<Category[]>;
  updateCategoryWeight(id: string, weight: number): Promise<void>;
}

export interface EmbeddingService {
  embedText(text: string): Promise<number[]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
}

export interface ContextService {
  categoryService: CategoryService;
  contextOptimizer: ContextOptimizer;
  request: ContextRequest;
}

export interface ContextFactory {
  createContextService(request: ContextRequest): Promise<ContextService>;
} 