"use client";

import { useEffect, useState, useMemo } from "react";
import Embeddings3DPlot from "./Embeddings3DPlot";

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories?: string[] | string;
    category?: string;
    [key: string]: any;
  };
}

interface NormalizedEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: any;
  };
}

interface DashboardProps {
  embeddings: Embedding[];
}

export default function Dashboard({ embeddings }: DashboardProps) {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Normalize embeddings to ensure categories is always a string array
  const normalizedEmbeddings = useMemo<NormalizedEmbedding[]>(() => {
    return embeddings.map(emb => {
      let categories: string[] = [];
      
      // Handle different category formats
      if (emb.metadata.categories) {
        if (Array.isArray(emb.metadata.categories)) {
          categories = emb.metadata.categories;
        } else if (typeof emb.metadata.categories === 'string') {
          try {
            // Try to parse JSON string
            const parsed = JSON.parse(emb.metadata.categories);
            categories = Array.isArray(parsed) ? parsed : [emb.metadata.categories];
          } catch {
            categories = [emb.metadata.categories];
          }
        }
      } else if (emb.metadata.category && typeof emb.metadata.category === 'string') {
        categories = [emb.metadata.category];
      } else {
        categories = ["Uncategorized"];
      }
      
      return {
        ...emb,
        metadata: {
          ...emb.metadata,
          categories
        }
      };
    });
  }, [embeddings]);

  // Extract all unique categories
  const allCategories = useMemo(() => {
    const categorySet = new Set<string>();
    normalizedEmbeddings.forEach(e => {
      if (e.metadata.categories && Array.isArray(e.metadata.categories)) {
        e.metadata.categories.forEach(cat => categorySet.add(cat));
      }
    });
    return Array.from(categorySet).sort();
  }, [normalizedEmbeddings]);

  // Toggle category selection
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Summary statistics
  const totalEmbeddings = normalizedEmbeddings.length;
  const avgVectorLength =
    totalEmbeddings > 0
      ? (
          normalizedEmbeddings.reduce((sum, e) => sum + e.vector.length, 0) /
          totalEmbeddings
        ).toFixed(2)
      : 0;
  
  // Category statistics
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    normalizedEmbeddings.forEach(e => {
      e.metadata.categories.forEach(cat => {
        stats[cat] = (stats[cat] || 0) + 1;
      });
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [normalizedEmbeddings]);

  // Filtered embeddings for analysis
  const filtered = useMemo(() => {
    return normalizedEmbeddings.filter(e => {
      // Filter by text search
      const matchesSearch = !search || 
        (e.metadata.text && typeof e.metadata.text === 'string' && 
         e.metadata.text.toLowerCase().includes(search.toLowerCase()));
      
      // Filter by selected categories
      const matchesCategories = selectedCategories.length === 0 || 
        (e.metadata.categories && 
         selectedCategories.some(cat => e.metadata.categories.includes(cat)));
      
      return matchesSearch && matchesCategories;
    });
  }, [normalizedEmbeddings, search, selectedCategories]);

  // Embedding analysis calculations
  function vectorNorm(vec: number[]): number {
    return Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  }
  const norms = filtered.map(e => vectorNorm(e.vector));
  const minNorm = norms.length ? Math.min(...norms).toFixed(2) : "-";
  const maxNorm = norms.length ? Math.max(...norms).toFixed(2) : "-";
  const meanNorm = norms.length ? (norms.reduce((a, b) => a + b, 0) / norms.length).toFixed(2) : "-";

  function getMostCommonWords(texts: string[], topN = 5): [string, number][] {
    const wordCounts: Record<string, number> = {};
    for (const text of texts) {
      for (const word of text.toLowerCase().split(/\W+/)) {
        if (word.length > 2) wordCounts[word] = (wordCounts[word] || 0) + 1;
      }
    }
    return Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN);
  }
  const texts = filtered.map(e => (typeof e.metadata.text === 'string' ? e.metadata.text : ''));
  const commonWords = getMostCommonWords(texts);

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full h-full bg-background text-foreground overflow-auto">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Embeddings Dashboard</h1>
      {loading ? (
        <div className="text-center py-8">
          <div className="text-base sm:text-lg">Loading embeddings...</div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center py-8">
          <div className="text-sm sm:text-base">{error}</div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="text-sm sm:text-base font-semibold text-muted-foreground">Total Embeddings</div>
              <div className="text-xl sm:text-2xl font-bold">{totalEmbeddings}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="text-sm sm:text-base font-semibold text-muted-foreground">Avg. Vector Length</div>
              <div className="text-xl sm:text-2xl font-bold">{avgVectorLength}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
              <div className="text-sm sm:text-base font-semibold text-muted-foreground">Filtered Embeddings</div>
              <div className="text-xl sm:text-2xl font-bold">{filtered.length}</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="mb-4 sm:mb-6 space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded-md px-3 py-2.5 sm:py-2 w-full max-w-md text-sm bg-background border-input focus:ring-2 focus:ring-ring focus:border-transparent outline-none min-h-[44px] sm:min-h-[40px]"
              />
            </div>
            
            {allCategories.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 sm:mb-3">Filter by Category:</h3>
                <div className="flex flex-wrap gap-2 mb-2 sm:mb-3">
                  {allCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-2 text-sm rounded-md transition-colors min-h-[40px] touch-manipulation ${
                        selectedCategories.includes(category)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground italic">
                  {allCategories.length} categories found. Click to toggle selection.
                </div>
              </div>
            )}
          </div>

          {/* Category Distribution */}
          {categoryStats.length > 0 && (
            <div className="mb-4 sm:mb-6">
              <h3 className="text-sm font-medium mb-2 sm:mb-3">Category Distribution:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {categoryStats.map(([category, count]) => (
                  <div 
                    key={category}
                    className="bg-muted/40 rounded-md p-3 text-sm flex justify-between items-center cursor-pointer hover:bg-muted/60 transition-colors min-h-[48px] touch-manipulation"
                    onClick={() => toggleCategory(category)}
                  >
                    <span className="truncate mr-2 text-sm">{category}</span>
                    <span className="bg-muted rounded-full px-2 py-1 text-xs font-medium flex-shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3D Plot */}
          {filtered.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <Embeddings3DPlot embeddings={filtered} />
            </div>
          )}

          {/* Embedding Analysis Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-muted rounded-lg shadow p-4 flex flex-col items-start">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Min Vector Norm</div>
              <div className="text-xl sm:text-2xl font-bold">{minNorm}</div>
            </div>
            <div className="bg-muted rounded-lg shadow p-4 flex flex-col items-start">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Max Vector Norm</div>
              <div className="text-xl sm:text-2xl font-bold">{maxNorm}</div>
            </div>
            <div className="bg-muted rounded-lg shadow p-4 flex flex-col items-start">
              <div className="text-xs sm:text-sm text-muted-foreground mb-1">Mean Vector Norm</div>
              <div className="text-xl sm:text-2xl font-bold">{meanNorm}</div>
            </div>
            <div className="bg-muted rounded-lg shadow p-4 col-span-1 sm:col-span-2 lg:col-span-3">
              <div className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">Most Common Words</div>
              <div className="flex flex-wrap gap-2">
                {commonWords.map(([word, count]) => (
                  <div key={word} className="bg-background px-3 py-2 rounded-md text-sm border">
                    <span className="font-medium">{word}</span>
                    <span className="text-xs text-muted-foreground ml-1">({count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 