"use client";

import { useEffect, useState, useRef } from "react";
import Dashboard from "./Dashboard";
import { XCircle } from 'lucide-react';

interface EmbeddingMetadata {
  text: string;
  categories?: string[] | string;
  category?: string;
  title?: string;
  source?: string;
  [key: string]: string | string[] | undefined;
}

interface Embedding {
  id: string;
  vector: number[];
  metadata: EmbeddingMetadata;
}

export default function ClientVisualization() {
  const [embeddings, setEmbeddings] = useState<Embedding[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const mounted = useRef(false);

  useEffect(() => {
    // Prevent double fetching in development
    if (mounted.current) return;
    mounted.current = true;

    async function fetchEmbeddings() {
      setLoading(true);
      try {
        const response = await fetch("/api/embeddings");
        if (!response.ok) throw new Error("Failed to fetch embeddings");
        const data = await response.json();
        
        // Process and normalize embeddings to ensure proper category handling
        const processedEmbeddings = data.embeddings.map((emb: Partial<Embedding>) => {
          // Create a new embedding object with properly typed structure
          const processedEmb: Embedding = {
            id: emb.id || "",
            vector: emb.vector || [],
            metadata: {
              ...emb.metadata,
              text: emb.metadata?.text || ""
            }
          };
          
          // Process categories appropriately
          if (emb.metadata?.categories) {
            processedEmb.metadata.categories = emb.metadata.categories;
          } else if (emb.metadata?.category) {
            processedEmb.metadata.category = emb.metadata.category;
          }
          
          return processedEmb;
        });
        
        console.log("Processed embeddings:", processedEmbeddings);
        setEmbeddings(processedEmbeddings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchEmbeddings();
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500 p-4 sm:p-6">
        <XCircle className="w-10 h-10 sm:w-12 sm:h-12 mb-3 sm:mb-4" />
        <h2 className="text-lg sm:text-xl font-semibold mb-2 text-center">Error Loading Embeddings</h2>
        <p className="text-sm sm:text-base text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen relative">
      {loading ? (
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <div className="text-base sm:text-lg">Loading embeddings...</div>
          </div>
        </div>
      ) : (
        <Dashboard embeddings={embeddings} />
      )}
    </div>
  );
}