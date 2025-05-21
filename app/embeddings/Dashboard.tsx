"use client";

import { useEffect, useState } from "react";
import Embeddings3DPlot from "./Embeddings3DPlot";

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: string | number | boolean;
  };
}

export default function Dashboard() {
  const [embeddings, setEmbeddings] = useState<Embedding[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmbeddings() {
      setLoading(true);
      try {
        const response = await fetch("/api/embeddings");
        if (!response.ok) throw new Error("Failed to fetch embeddings");
        const data = await response.json();
        setEmbeddings(data.embeddings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchEmbeddings();
  }, []);

  // Summary statistics
  const totalEmbeddings = embeddings.length;
  const avgVectorLength =
    totalEmbeddings > 0
      ? (
          embeddings.reduce((sum, e) => sum + e.vector.length, 0) /
          totalEmbeddings
        ).toFixed(2)
      : 0;

  // Filtered embeddings for analysis
  const filtered = search
    ? embeddings.filter((e) =>
        e.metadata.text?.toLowerCase().includes(search.toLowerCase())
      )
    : embeddings;

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
    <div className="p-8 w-full h-full bg-background text-foreground overflow-auto">
      <h1 className="text-2xl font-bold mb-4">Embeddings Dashboard</h1>
      {loading ? (
        <div>Loading embeddings...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-6 flex gap-8">
            <div>
              <div className="text-lg font-semibold">Total Embeddings</div>
              <div className="text-2xl">{totalEmbeddings}</div>
            </div>
            <div>
              <div className="text-lg font-semibold">Avg. Vector Length</div>
              <div className="text-2xl">{avgVectorLength}</div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border rounded px-3 py-2 w-full max-w-md"
            />
          </div>

          {/* 3D Plot */}
          {embeddings.length > 0 && <Embeddings3DPlot embeddings={embeddings} />}

          {/* Embedding Analysis Dashboard */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-muted rounded shadow p-4 flex flex-col items-start">
              <div className="text-sm text-muted-foreground mb-1">Min Vector Norm</div>
              <div className="text-2xl font-bold">{minNorm}</div>
            </div>
            <div className="bg-muted rounded shadow p-4 flex flex-col items-start">
              <div className="text-sm text-muted-foreground mb-1">Max Vector Norm</div>
              <div className="text-2xl font-bold">{maxNorm}</div>
            </div>
            <div className="bg-muted rounded shadow p-4 flex flex-col items-start">
              <div className="text-sm text-muted-foreground mb-1">Mean Vector Norm</div>
              <div className="text-2xl font-bold">{meanNorm}</div>
            </div>
            <div className="bg-muted rounded shadow p-4 col-span-1 md:col-span-3">
              <div className="text-sm text-muted-foreground mb-1">Most Common Words</div>
              <ul className="flex flex-wrap gap-4">
                {commonWords.map(([word, count]) => (
                  <li key={word} className="bg-background px-2 py-1 rounded text-sm">
                    {word} <span className="text-xs text-muted-foreground">({count})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 