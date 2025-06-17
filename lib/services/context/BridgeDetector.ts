import { Vector, CategoryBridge, BridgeMetrics } from './types';
import { similarity } from 'ml-distance';

export class BridgeDetector {
  async detectBridges(
    categories: string[],
    vectors: Vector[],
    minStrength: number
  ): Promise<CategoryBridge[]> {
    const bridges: CategoryBridge[] = [];
    
    // Analyze each category pair
    for (let i = 0; i < categories.length; i++) {
      for (let j = i + 1; j < categories.length; j++) {
        const bridge = await this.analyzeBridge(
          categories[i],
          categories[j],
          vectors,
          minStrength
        );
        
        if (bridge) {
          bridges.push(bridge);
        }
      }
    }
    
    return bridges;
  }

  private async analyzeBridge(
    sourceCategory: string,
    targetCategory: string,
    vectors: Vector[],
    minStrength: number
  ): Promise<CategoryBridge | null> {
    // Get vectors for each category
    const sourceVectors = vectors.filter(v => v.metadata.category === sourceCategory);
    const targetVectors = vectors.filter(v => v.metadata.category === targetCategory);

    // Calculate bridge metrics
    const metrics = await this.calculateBridgeMetrics(
      sourceVectors,
      targetVectors
    );

    // Calculate overall bridge strength
    const bridgeStrength = this.calculateBridgeStrength(metrics);

    if (bridgeStrength < minStrength) {
      return null;
    }

    // Find shared contexts
    const sharedContexts = await this.findSharedContexts(
      sourceVectors,
      targetVectors
    );

    return {
      id: `${sourceCategory}-${targetCategory}`,
      sourceCategory,
      targetCategory,
      bridgeStrength,
      sharedContexts: sharedContexts.map(v => v.id),
      metrics,
      timestamp: Date.now()
    };
  }

  private async calculateBridgeMetrics(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): Promise<BridgeMetrics> {
    // Calculate semantic similarity
    const semanticSimilarity = await this.calculateSemanticSimilarity(
      sourceVectors,
      targetVectors
    );

    // Calculate context overlap
    const contextOverlap = this.calculateContextOverlap(
      sourceVectors,
      targetVectors
    );

    // Calculate user interaction patterns
    const userInteraction = await this.calculateUserInteraction(
      sourceVectors,
      targetVectors
    );

    // Calculate temporal proximity
    const temporalProximity = this.calculateTemporalProximity(
      sourceVectors,
      targetVectors
    );

    return {
      semanticSimilarity,
      contextOverlap,
      userInteraction,
      temporalProximity
    };
  }

  private async calculateSemanticSimilarity(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): Promise<number> {
    // Calculate average vectors
    const sourceAvg = this.calculateAverageVector(sourceVectors);
    const targetAvg = this.calculateAverageVector(targetVectors);

    // Calculate cosine similarity
    return 1 - similarity.cosine(sourceAvg, targetAvg);
  }

  private calculateAverageVector(vectors: Vector[]): number[] {
    if (vectors.length === 0) return Array(768).fill(0);
    
    const sum = vectors.reduce((acc, vector) => {
      return acc.map((val, i) => val + vector.values[i]);
    }, Array(768).fill(0));
    
    return sum.map(val => val / vectors.length);
  }

  private calculateContextOverlap(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): number {
    const sourceContent = new Set(sourceVectors.map(v => v.metadata.content));
    const targetContent = new Set(targetVectors.map(v => v.metadata.content));
    
    let overlap = 0;
    sourceContent.forEach(content => {
      if (content && targetContent.has(content)) {
        overlap++;
      }
    });
    
    return overlap / (sourceContent.size + targetContent.size - overlap);
  }

  private async calculateUserInteraction(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): Promise<number> {
    // This would typically involve analyzing user interaction patterns
    // For now, return a placeholder value
    return 0.5;
  }

  private calculateTemporalProximity(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): number {
    const sourceTimestamps = sourceVectors.map(v => v.metadata.timestamp);
    const targetTimestamps = targetVectors.map(v => v.metadata.timestamp);
    
    const avgSourceTime = sourceTimestamps.reduce((a, b) => a + b, 0) / sourceTimestamps.length;
    const avgTargetTime = targetTimestamps.reduce((a, b) => a + b, 0) / targetTimestamps.length;
    
    // Calculate normalized temporal proximity (0-1)
    const timeDiff = Math.abs(avgSourceTime - avgTargetTime);
    const maxDiff = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    
    return Math.max(0, 1 - (timeDiff / maxDiff));
  }

  private calculateBridgeStrength(metrics: BridgeMetrics): number {
    // Weighted average of metrics
    const weights = {
      semanticSimilarity: 0.4,
      contextOverlap: 0.3,
      userInteraction: 0.2,
      temporalProximity: 0.1
    };
    
    return (
      metrics.semanticSimilarity * weights.semanticSimilarity +
      metrics.contextOverlap * weights.contextOverlap +
      metrics.userInteraction * weights.userInteraction +
      metrics.temporalProximity * weights.temporalProximity
    );
  }

  private async findSharedContexts(
    sourceVectors: Vector[],
    targetVectors: Vector[]
  ): Promise<Vector[]> {
    const sharedContexts: Vector[] = [];
    const similarityThreshold = 0.8;
    
    for (const sourceVector of sourceVectors) {
      for (const targetVector of targetVectors) {
        const similarityScore = 1 - similarity.cosine(sourceVector.values, targetVector.values);
        if (similarityScore > similarityThreshold) {
          sharedContexts.push(sourceVector);
          break;
        }
      }
    }
    
    return sharedContexts;
  }
} 