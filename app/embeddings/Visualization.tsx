"use client";

import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { XCircle } from 'lucide-react';

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories?: string[];
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
        
        // Ensure each embedding has a categories array if missing
        const processedEmbeddings = data.embeddings.map((emb: Embedding) => {
          // If embedding doesn't have categories, try to extract them from metadata
          if (!emb.metadata.categories) {
            // Create categories based on available metadata
            const extractedCategories = [];
            
            // Use document type if available
            if (emb.metadata.docType) {
              extractedCategories.push(emb.metadata.docType);
            }
            
            // Use file type if available
            if (emb.metadata.fileType) {
              extractedCategories.push(emb.metadata.fileType);
            }
            
            // Use source if available
            if (emb.metadata.source) {
              extractedCategories.push(emb.metadata.source);
            }
            
            // If no categories could be extracted, use "Uncategorized"
            if (extractedCategories.length === 0) {
              extractedCategories.push("Uncategorized");
            }
            
            return {
              ...emb,
              metadata: {
                ...emb.metadata,
                categories: extractedCategories
              }
            };
          }
          return emb;
        });
        
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