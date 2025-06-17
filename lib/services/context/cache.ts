import { ProcessedContext } from './types';
import { CONTEXT_CONFIG } from './config';

interface CacheEntry {
  data: ProcessedContext;
  timestamp: number;
}

export class ContextCache {
  private cache: Map<string, CacheEntry>;
  
  constructor() {
    this.cache = new Map();
  }
  
  get(key: string): ProcessedContext | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > CONTEXT_CONFIG.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  set(key: string, data: ProcessedContext): void {
    // Enforce cache size limit
    if (this.cache.size >= CONTEXT_CONFIG.MAX_CACHE_SIZE) {
      // Remove oldest entry
      const oldestKey = Array.from(this.cache.entries())
        .reduce((oldest, current) => 
          current[1].timestamp < oldest[1].timestamp ? current : oldest
        )[0];
      
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  generateKey(categories: string[], userId: string): string {
    return `${categories.sort().join('-')}-${userId}`;
  }
} 