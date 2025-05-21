"use client";

import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import { XCircle } from 'lucide-react';

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: string | number | boolean;
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
        setEmbeddings(data.embeddings);
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
        <Dashboard />
      )}
    </div>
  );
}