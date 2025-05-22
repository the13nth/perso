"use client";

import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { XCircle } from 'lucide-react';

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

export default function ClientVisualization() {
  const [embeddings, setEmbeddings] = useState<Embedding[]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEmbeddings() {
      setLoading(true);
      try {
        const response = await fetch("/api/embeddings");
        if (!response.ok) throw new Error("Failed to fetch embeddings");
        const data = await response.json();
        
        // Process and normalize embeddings to ensure proper category handling
        const processedEmbeddings = data.embeddings.map((emb: any) => {
          // Create a new embedding object with properly typed structure
          const processedEmb: Embedding = {
            id: emb.id,
            vector: emb.vector,
              metadata: {
                ...emb.metadata,
              text: emb.metadata.text || "",
            }
          };
          
          // Process categories appropriately
          if (emb.metadata.categories) {
            processedEmb.metadata.categories = emb.metadata.categories;
          } else if (emb.metadata.category) {
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
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500 p-4">
        <XCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Embeddings</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {loading ? (
        <div className="flex items-center justify-center h-full">Loading embeddings...</div>
      ) : (
        <Dashboard embeddings={embeddings} />
      )}
    </div>
  );
}