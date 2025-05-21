"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import * as PCA from "ml-pca";
// If you get a type error for react-plotly.js, try: yarn add -D @types/react-plotly.js
// or add a .d.ts file with: declare module 'react-plotly.js';

// @ts-ignore
const Plot = dynamic<Record<string, unknown>>(() => import("react-plotly.js"), { ssr: false });

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: string | number | boolean;
  };
}

interface Props {
  embeddings: Embedding[];
}

export default function Embeddings3DPlot({ embeddings }: Props) {
  // Compute PCA and prepare plot data
  const { x, y, z, texts } = useMemo(() => {
    if (!embeddings.length) return { x: [], y: [], z: [], texts: [] };
    // Sort embeddings by ID for deterministic PCA
    const sortedEmbeddings = [...embeddings].sort((a, b) => a.id.localeCompare(b.id));
    const vectors = sortedEmbeddings.map(e => e.vector);
    // Run PCA to reduce to 3D
    const pca = new PCA.PCA(vectors);
    const reduced: number[][] = pca.predict(vectors, { nComponents: 3 }).to2DArray();
    return {
      x: reduced.map((row: number[]) => row[0]),
      y: reduced.map((row: number[]) => row[1]),
      z: reduced.map((row: number[]) => row[2]),
      texts: sortedEmbeddings.map(e => (typeof e.metadata.text === 'string' ? e.metadata.text.slice(0, 100) : '')),
    };
  }, [embeddings]);

  return (
    <div className="w-full h-[500px] bg-background mb-8 rounded-lg shadow">
      {/* @ts-ignore */}
      {(
        // @ts-ignore
        <Plot
          data={[
            {
              x,
              y,
              z,
              text: texts,
              type: "scatter3d",
              mode: "markers",
              marker: {
                size: 5,
                color: "#38bdf8",
                opacity: 0.8,
              },
              hovertemplate: "%{text}<extra></extra>",
            },
          ]}
          layout={{
            autosize: true,
            height: 500,
            margin: { l: 0, r: 0, b: 0, t: 30 },
            paper_bgcolor: "#18181b",
            plot_bgcolor: "#18181b",
            font: { color: "#f1f5f9" },
            title: "3D Embedding Visualization (PCA)",
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
} 