import { CategoryService, ContextFactory, ContextOptimizer, ContextRequest, ContextService } from './types';
import { DefaultCategoryService } from './CategoryService';
import { GeminiEmbeddingService } from './EmbeddingService';
import { DefaultContextOptimizer } from './ContextOptimizer';

export class DefaultContextFactory implements ContextFactory {
  private static instance: DefaultContextFactory;
  private categoryService: CategoryService;
  private contextOptimizer: ContextOptimizer;

  private constructor() {
    console.log('[ContextFactory] Initializing DefaultContextFactory');
    const embeddingService = new GeminiEmbeddingService();
    this.categoryService = new DefaultCategoryService();
    this.contextOptimizer = new DefaultContextOptimizer(embeddingService);
    console.log('[ContextFactory] Services initialized successfully');
  }

  static getInstance(): DefaultContextFactory {
    console.log('[ContextFactory] Getting factory instance');
    if (!DefaultContextFactory.instance) {
      console.log('[ContextFactory] Creating new factory instance');
      DefaultContextFactory.instance = new DefaultContextFactory();
    }
    return DefaultContextFactory.instance;
  }

  async createContextService(request: ContextRequest): Promise<ContextService> {
    console.log('[ContextFactory] Creating new ContextService');
    console.log('[ContextFactory] Request parameters:', {
      query: request.query,
      maxChunks: request.maxChunks,
      minRelevance: request.minRelevance,
      includeRelatedCategories: request.includeRelatedCategories
    });

    return {
      categoryService: this.categoryService,
      contextOptimizer: this.contextOptimizer,
      request
    };
  }
} 