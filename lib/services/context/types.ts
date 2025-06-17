export interface Vector {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface VectorMetadata {
  category: string;
  type: 'document' | 'note' | 'activity';
  title?: string;
  content?: string;
  timestamp: number;
  userId: string;
}

export interface CategoryBridge {
  id: string;
  sourceCategory: string;
  targetCategory: string;
  bridgeStrength: number;
  sharedContexts: string[]; // Vector IDs
  metrics: BridgeMetrics;
  timestamp: number;
}

export interface BridgeMetrics {
  semanticSimilarity: number;  // 0-1
  contextOverlap: number;      // 0-1
  userInteraction: number;     // 0-1
  temporalProximity: number;   // 0-1
}

export interface ContextScore {
  directRelevance: number;     // 0-1
  bridgeRelevance: number;     // 0-1
  crossCategoryImportance: number; // 0-1
  timestamp: number;
}

export interface ProcessedContext {
  vectors: Vector[];
  bridges: CategoryBridge[];
  scores: Map<string, ContextScore>; // Vector ID to score
  metadata: {
    processingTime: number;
    totalVectors: number;
    categories: string[];
  };
} 