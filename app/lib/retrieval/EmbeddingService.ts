import { EmbeddingService } from './types';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export class GeminiEmbeddingService implements EmbeddingService {
  private model: GenerativeModel;
  
  constructor() {
    console.log('[EmbeddingService] Initializing Gemini Embedding Service');
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
    this.model = genAI.getGenerativeModel({ model: "embedding-001" });
    console.log('[EmbeddingService] Successfully initialized Gemini model');
  }

  async embedText(text: string): Promise<number[]> {
    console.log(`[EmbeddingService] Generating embedding for text (length: ${text.length} chars)`);
    try {
      const startTime = performance.now();
      const result = await this.model.embedContent(text);
      const endTime = performance.now();
      
      console.log(`[EmbeddingService] Successfully generated embedding in ${(endTime - startTime).toFixed(2)}ms`);
      console.log(`[EmbeddingService] Embedding dimension: ${result.embedding.values.length}`);
      
      return result.embedding.values;
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    console.log(`[EmbeddingService] Calculating similarity between embeddings (dimension: ${embedding1.length})`);
    
    if (embedding1.length !== embedding2.length) {
      console.error(`[EmbeddingService] Dimension mismatch: ${embedding1.length} vs ${embedding2.length}`);
      throw new Error('Embeddings must have the same dimensions');
    }

    const startTime = performance.now();
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      console.warn('[EmbeddingService] Zero norm detected, returning similarity of 0');
      return 0;
    }

    const similarity = dotProduct / (norm1 * norm2);
    const endTime = performance.now();

    console.log(`[EmbeddingService] Similarity calculation completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`[EmbeddingService] Similarity score: ${similarity.toFixed(4)}`);

    return similarity;
  }
} 