export const CONTEXT_CONFIG = {
  // Vector retrieval
  MAX_VECTORS_PER_CATEGORY: 2000,
  MIN_VECTOR_SCORE: 0.3,
  
  // Bridge detection
  MIN_BRIDGE_STRENGTH: 0.5,
  MIN_SECONDARY_BRIDGE_STRENGTH: 0.3,
  BRIDGE_SIMILARITY_THRESHOLD: 0.7,
  
  // Context processing
  DEDUPLICATION_THRESHOLD: 0.9,
  INCLUDE_SECONDARY_BRIDGES: true,
  
  // Scoring weights
  WEIGHTS: {
    SEMANTIC_SIMILARITY: 0.4,
    CONTEXT_OVERLAP: 0.3,
    USER_INTERACTION: 0.2,
    TEMPORAL_PROXIMITY: 0.1
  },
  
  // Performance
  BATCH_SIZE: 100,
  MAX_PARALLEL_REQUESTS: 5,
  
  // Vector dimensions
  VECTOR_DIMENSION: 768,
  
  // Cache settings
  CACHE_TTL: 1000 * 60 * 5, // 5 minutes
  MAX_CACHE_SIZE: 1000
}; 