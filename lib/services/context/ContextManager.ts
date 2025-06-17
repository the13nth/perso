import { Pinecone } from '@pinecone-database/pinecone';
import { 
  Vector, 
  CategoryBridge, 
  ProcessedContext, 
  ContextScore 
} from './types';
import { BridgeDetector } from './BridgeDetector';
import { ContextProcessor } from './ContextProcessor';
import { ContextCache } from './cache';
import { CONTEXT_CONFIG } from './config';

export class ContextManager {
  private pinecone: Pinecone;
  private bridgeDetector: BridgeDetector;
  private contextProcessor: ContextProcessor;
  private cache: ContextCache;
  
  constructor() {
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });
    this.bridgeDetector = new BridgeDetector();
    this.contextProcessor = new ContextProcessor();
    this.cache = new ContextCache();
  }

  async getEnhancedContext(
    categories: string[],
    userId: string,
    options = {
      maxVectors: CONTEXT_CONFIG.MAX_VECTORS_PER_CATEGORY,
      minBridgeStrength: CONTEXT_CONFIG.MIN_BRIDGE_STRENGTH,
      includeSecondaryBridges: CONTEXT_CONFIG.INCLUDE_SECONDARY_BRIDGES
    }
  ): Promise<ProcessedContext> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.cache.generateKey(categories, userId);
    const cachedContext = this.cache.get(cacheKey);
    if (cachedContext) {
      return cachedContext;
    }

    // Process in batches for large requests
    const batchedCategories = this.batchCategories(categories);
    const allVectors: Vector[] = [];

    for (const batch of batchedCategories) {
      const vectorPromises = batch.map(category =>
        this.getVectorsForCategory(category, userId, options.maxVectors)
      );
      const batchVectors = await Promise.all(vectorPromises);
      allVectors.push(...batchVectors.flat());
    }

    // Detect and analyze bridges
    const bridges = await this.bridgeDetector.detectBridges(
      categories,
      allVectors,
      options.minBridgeStrength
    );

    // Process context with bridges
    const processedContext = await this.contextProcessor.process(
      allVectors,
      bridges,
      {
        includeSecondaryBridges: options.includeSecondaryBridges,
        deduplicationThreshold: CONTEXT_CONFIG.DEDUPLICATION_THRESHOLD,
        minScore: CONTEXT_CONFIG.MIN_VECTOR_SCORE
      }
    );

    // Add metadata and cache
    const result = {
      ...processedContext,
      metadata: {
        processingTime: Date.now() - startTime,
        totalVectors: allVectors.length,
        categories
      }
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  private batchCategories(categories: string[]): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < categories.length; i += CONTEXT_CONFIG.MAX_PARALLEL_REQUESTS) {
      batches.push(categories.slice(i, i + CONTEXT_CONFIG.MAX_PARALLEL_REQUESTS));
    }
    return batches;
  }

  private async getVectorsForCategory(
    category: string,
    userId: string,
    limit: number
  ): Promise<Vector[]> {
    const index = this.pinecone.index(process.env.PINECONE_INDEX || "");
    
    const response = await index.query({
      vector: Array(CONTEXT_CONFIG.VECTOR_DIMENSION).fill(0),
      topK: limit,
      filter: {
        userId,
        category
      },
      includeMetadata: true,
      includeValues: true
    });

    return response.matches.map(match => ({
      id: match.id,
      values: match.values as number[],
      metadata: match.metadata as any
    }));
  }

  async updateContextScores(
    context: ProcessedContext,
    newScores: Map<string, ContextScore>
  ): Promise<ProcessedContext> {
    return {
      ...context,
      scores: new Map([...context.scores, ...newScores])
    };
  }
} 