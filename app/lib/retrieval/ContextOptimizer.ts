import { ContextChunk, ContextOptimizer, ContextRequest, EmbeddingService } from './types';

export class DefaultContextOptimizer implements ContextOptimizer {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly maxTokens: number = 4000 // Adjust based on model context window
  ) {}

  async optimizeContext(chunks: ContextChunk[], request: ContextRequest): Promise<ContextChunk[]> {
    // If chunks are empty, return early
    if (!chunks.length) return [];

    // Get query embedding
    const queryEmbedding = await this.embeddingService.embedText(request.query);

    // Score and sort chunks
    const scoredChunks = await Promise.all(
      chunks.map(async (chunk) => {
        // If chunk doesn't have embedding, embed it
        const embedding = chunk.embedding || await this.embeddingService.embedText(chunk.content);
        
        // Calculate similarity score
        const similarityScore = this.embeddingService.calculateSimilarity(queryEmbedding, embedding);
        
        return {
          ...chunk,
          relevanceScore: similarityScore
        };
      })
    );

    // Sort by relevance score
    const sortedChunks = scoredChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter by minimum relevance
    const relevantChunks = sortedChunks.filter(
      chunk => chunk.relevanceScore >= request.minRelevance
    );

    // Limit by maxChunks while respecting maxTokens
    let tokenCount = 0;
    const selectedChunks: ContextChunk[] = [];

    for (const chunk of relevantChunks) {
      // Rough token estimation (can be replaced with more accurate tokenizer)
      const estimatedTokens = chunk.content.split(/\s+/).length * 1.3;
      
      if (tokenCount + estimatedTokens > this.maxTokens) break;
      if (selectedChunks.length >= request.maxChunks) break;

      selectedChunks.push(chunk);
      tokenCount += estimatedTokens;
    }

    return selectedChunks;
  }
} 