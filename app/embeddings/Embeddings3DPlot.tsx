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
    categories?: string[];
    [key: string]: any;
  };
}

interface Props {
  embeddings: Embedding[];
}

// Predefined color palette for categories
const COLOR_PALETTE = [
  "#1f77b4", // blue
  "#ff7f0e", // orange
  "#2ca02c", // green
  "#d62728", // red
  "#9467bd", // purple
  "#8c564b", // brown
  "#e377c2", // pink
  "#7f7f7f", // gray
  "#bcbd22", // olive
  "#17becf", // teal
  "#aec7e8", // light blue
  "#ffbb78", // light orange
  "#98df8a", // light green
  "#ff9896", // light red
  "#c5b0d5", // light purple
  "#c49c94", // light brown
  "#f7b6d2", // light pink
  "#c7c7c7", // light gray
  "#dbdb8d", // light olive
  "#9edae5", // light teal
];

export default function Embeddings3DPlot({ embeddings }: Props) {
  // Compute PCA and prepare plot data
  const { x, y, z, texts, colors, categories, categoryColors } = useMemo(() => {
    if (!embeddings.length) return { 
      x: [], 
      y: [], 
      z: [], 
      texts: [], 
      colors: [],
      categories: [],
      categoryColors: {}
    };
    
    // Sort embeddings by ID for deterministic PCA
    const sortedEmbeddings = [...embeddings].sort((a, b) => a.id.localeCompare(b.id));
    const vectors = sortedEmbeddings.map(e => e.vector);
    
    // Check if we have enough data and dimensions for PCA
    if (vectors.length === 0) {
      return { 
        x: [], 
        y: [], 
        z: [], 
        texts: [], 
        colors: [],
        categories: [],
        categoryColors: {}
      };
    }
    
    // Get the dimension of the vectors
    const dimension = vectors[0].length;
    
    // Determine the number of components we can use
    // We can't have more components than samples or dimensions
    const maxComponents = Math.min(3, vectors.length, dimension);
    
    try {
      // Run PCA to reduce dimensions
      const pca = new PCA.PCA(vectors);
      const reduced = pca.predict(vectors, { nComponents: maxComponents });
      
      // Convert to arrays
      const result = reduced.to2DArray();
      
      // Extract all unique categories from embeddings
      const allCategories = new Set<string>();
      sortedEmbeddings.forEach(e => {
        if (e.metadata.categories && Array.isArray(e.metadata.categories)) {
          e.metadata.categories.forEach(cat => allCategories.add(cat));
        }
      });
      
      // Create a mapping of category to color
      const uniqueCategories = Array.from(allCategories);
      const categoryColors: Record<string, string> = {};
      uniqueCategories.forEach((category, index) => {
        categoryColors[category] = COLOR_PALETTE[index % COLOR_PALETTE.length];
      });
      
      // Assign colors based on categories
      const colors = sortedEmbeddings.map(e => {
        // If the embedding has categories, use the first one for color
        if (e.metadata.categories && Array.isArray(e.metadata.categories) && e.metadata.categories.length > 0) {
          const primaryCategory = e.metadata.categories[0];
          return categoryColors[primaryCategory];
        }
        // Default color for items without categories
        return "#38bdf8"; // Default blue
      });
      
      // Prepare coordinates, padding with zeros if we have fewer than 3 dimensions
      return {
        x: result.map((row: number[]) => row[0] || 0),
        y: result.map((row: number[]) => (maxComponents > 1 ? row[1] || 0 : 0)),
        z: result.map((row: number[]) => (maxComponents > 2 ? row[2] || 0 : 0)),
        texts: sortedEmbeddings.map(e => {
          const text = typeof e.metadata.text === 'string' ? e.metadata.text.slice(0, 100) : '';
          const categories = e.metadata.categories && Array.isArray(e.metadata.categories) 
            ? `<br>Categories: ${e.metadata.categories.join(", ")}` 
            : '';
          return `${text}${categories}`;
        }),
        colors,
        categories: uniqueCategories,
        categoryColors
      };
    } catch (error) {
      console.error("PCA calculation error:", error);
      // Fallback to a simple 1D visualization
      return {
        x: vectors.map(v => v[0] || 0),
        y: vectors.map(v => v[1] || 0),
        z: vectors.map(v => v[2] || 0),
        texts: sortedEmbeddings.map(e => (typeof e.metadata.text === 'string' ? e.metadata.text.slice(0, 100) : '')),
        colors: sortedEmbeddings.map(() => "#38bdf8"),
        categories: [],
        categoryColors: {}
      };
    }
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
                color: colors,
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
            scene: {
              xaxis: { title: 'Component 1' },
              yaxis: { title: 'Component 2' },
              zaxis: { title: 'Component 3' },
            },
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "100%" }}
        />
      )}
      
      {/* Category Legend */}
      {categories.length > 0 && (
        <div className="mt-4 p-3 bg-secondary/20 rounded-md">
          <h3 className="text-sm font-medium mb-2">Categories:</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <div key={category} className="flex items-center gap-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: categoryColors[category] }}
                ></div>
                <span className="text-xs">{category}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 