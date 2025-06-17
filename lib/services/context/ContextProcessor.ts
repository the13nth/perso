import { Vector, CategoryBridge, ProcessedContext, ContextScore } from './types';
import { similarity } from 'ml-distance';

interface ProcessingOptions {
  includeSecondaryBridges: boolean;
  deduplicationThreshold?: number;
  minScore?: number;
}

export class ContextProcessor {
  async process(
    vectors: Vector[],
    bridges: CategoryBridge[],
    options: ProcessingOptions
  ): Promise<ProcessedContext> {
    // 1. Initial scoring
    const scores = await this.scoreVectors(vectors, bridges);
    
    // 2. Deduplication
    const dedupedVectors = await this.deduplicateVectors(
      vectors,
      options.deduplicationThreshold || 0.9
    );
    
    // 3. Filter by minimum score
    const filteredVectors = this.filterByScore(
      dedupedVectors,
      scores,
      options.minScore || 0.3
    );
    
    // 4. Process secondary bridges if needed
    let processedBridges = bridges;
    if (options.includeSecondaryBridges) {
      processedBridges = await this.processSecondaryBridges(
        bridges,
        filteredVectors
      );
    }
    
    return {
      vectors: filteredVectors,
      bridges: processedBridges,
      scores,
      metadata: {
        processingTime: 0,  // Will be set by ContextManager
        totalVectors: filteredVectors.length,
        categories: [...new Set(filteredVectors.map(v => v.metadata.category))]
      }
    };
  }

  private async scoreVectors(
    vectors: Vector[],
    bridges: CategoryBridge[]
  ): Promise<Map<string, ContextScore>> {
    const scores = new Map<string, ContextScore>();
    
    for (const vector of vectors) {
      const directRelevance = await this.calculateDirectRelevance(vector);
      const bridgeRelevance = this.calculateBridgeRelevance(vector, bridges);
      const crossCategoryImportance = this.calculateCrossImportance(
        vector,
        bridges
      );
      
      scores.set(vector.id, {
        directRelevance,
        bridgeRelevance,
        crossCategoryImportance,
        timestamp: Date.now()
      });
    }
    
    return scores;
  }

  private async calculateDirectRelevance(vector: Vector): Promise<number> {
    // This would typically involve comparing with the query vector
    // For now, return a placeholder based on metadata
    return vector.metadata.content ? 0.8 : 0.5;
  }

  private calculateBridgeRelevance(
    vector: Vector,
    bridges: CategoryBridge[]
  ): number {
    const relevantBridges = bridges.filter(bridge =>
      bridge.sharedContexts.includes(vector.id)
    );
    
    if (relevantBridges.length === 0) return 0;
    
    return relevantBridges.reduce(
      (acc, bridge) => acc + bridge.bridgeStrength,
      0
    ) / relevantBridges.length;
  }

  private calculateCrossImportance(
    vector: Vector,
    bridges: CategoryBridge[]
  ): number {
    const category = vector.metadata.category;
    const relevantBridges = bridges.filter(bridge =>
      bridge.sourceCategory === category || bridge.targetCategory === category
    );
    
    if (relevantBridges.length === 0) return 0;
    
    return relevantBridges.reduce(
      (acc, bridge) => acc + bridge.bridgeStrength,
      0
    ) / relevantBridges.length;
  }

  private async deduplicateVectors(
    vectors: Vector[],
    threshold: number
  ): Promise<Vector[]> {
    const dedupedVectors: Vector[] = [];
    const seen = new Set<string>();
    
    for (const vector of vectors) {
      let isDuplicate = false;
      
      for (const seenVector of dedupedVectors) {
        const similarityScore = 1 - similarity.cosine(vector.values, seenVector.values);
        if (similarityScore > threshold) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate && !seen.has(vector.id)) {
        dedupedVectors.push(vector);
        seen.add(vector.id);
      }
    }
    
    return dedupedVectors;
  }

  private filterByScore(
    vectors: Vector[],
    scores: Map<string, ContextScore>,
    minScore: number
  ): Vector[] {
    return vectors.filter(vector => {
      const score = scores.get(vector.id);
      if (!score) return false;
      
      const avgScore = (
        score.directRelevance +
        score.bridgeRelevance +
        score.crossCategoryImportance
      ) / 3;
      
      return avgScore >= minScore;
    });
  }

  private async processSecondaryBridges(
    bridges: CategoryBridge[],
    vectors: Vector[]
  ): Promise<CategoryBridge[]> {
    // Find categories that are connected through multiple bridges
    const categoryConnections = new Map<string, Set<string>>();
    
    bridges.forEach(bridge => {
      if (!categoryConnections.has(bridge.sourceCategory)) {
        categoryConnections.set(bridge.sourceCategory, new Set());
      }
      if (!categoryConnections.has(bridge.targetCategory)) {
        categoryConnections.set(bridge.targetCategory, new Set());
      }
      
      categoryConnections.get(bridge.sourceCategory)!.add(bridge.targetCategory);
      categoryConnections.get(bridge.targetCategory)!.add(bridge.sourceCategory);
    });
    
    // Find secondary bridges (categories connected through intermediaries)
    const secondaryBridges: CategoryBridge[] = [];
    
    categoryConnections.forEach((connections, category) => {
      connections.forEach(connectedCategory => {
        const intermediateCategories = Array.from(
          categoryConnections.get(connectedCategory) || []
        ).filter(c => c !== category && !connections.has(c));
        
        for (const intermediateCategory of intermediateCategories) {
          const sourceBridge = bridges.find(b =>
            (b.sourceCategory === category && b.targetCategory === connectedCategory) ||
            (b.sourceCategory === connectedCategory && b.targetCategory === category)
          );
          
          const targetBridge = bridges.find(b =>
            (b.sourceCategory === connectedCategory && b.targetCategory === intermediateCategory) ||
            (b.sourceCategory === intermediateCategory && b.targetCategory === connectedCategory)
          );
          
          if (sourceBridge && targetBridge) {
            const bridgeStrength = (sourceBridge.bridgeStrength + targetBridge.bridgeStrength) / 2;
            
            if (bridgeStrength >= 0.3) {  // Minimum strength for secondary bridges
              secondaryBridges.push({
                id: `${category}-${intermediateCategory}-secondary`,
                sourceCategory: category,
                targetCategory: intermediateCategory,
                bridgeStrength: bridgeStrength * 0.8,  // Reduce strength for secondary bridges
                sharedContexts: [],  // Will be populated below
                metrics: {
                  semanticSimilarity: (sourceBridge.metrics.semanticSimilarity + targetBridge.metrics.semanticSimilarity) / 2,
                  contextOverlap: (sourceBridge.metrics.contextOverlap + targetBridge.metrics.contextOverlap) / 2,
                  userInteraction: (sourceBridge.metrics.userInteraction + targetBridge.metrics.userInteraction) / 2,
                  temporalProximity: (sourceBridge.metrics.temporalProximity + targetBridge.metrics.temporalProximity) / 2
                },
                timestamp: Date.now()
              });
            }
          }
        }
      });
    });
    
    // Find shared contexts for secondary bridges
    for (const bridge of secondaryBridges) {
      const sourceVectors = vectors.filter(v => 
        v.metadata.category === bridge.sourceCategory
      );
      const targetVectors = vectors.filter(v =>
        v.metadata.category === bridge.targetCategory
      );
      
      const sharedContextIds = new Set<string>();
      
      for (const sourceVector of sourceVectors) {
        for (const targetVector of targetVectors) {
          const similarityScore = 1 - similarity.cosine(sourceVector.values, targetVector.values);
          if (similarityScore > 0.7) {  // Threshold for secondary bridge contexts
            sharedContextIds.add(sourceVector.id);
            sharedContextIds.add(targetVector.id);
          }
        }
      }
      
      bridge.sharedContexts = Array.from(sharedContextIds);
    }
    
    return [...bridges, ...secondaryBridges];
  }
} 