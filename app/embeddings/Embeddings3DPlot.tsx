"use client";

import { useEffect, useRef } from "react";
import * as PlotlyJS from 'plotly.js-dist-min';
import { PCA } from 'ml-pca';

interface NormalizedEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: any;
  };
}

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

interface PlotProps {
  embeddings: NormalizedEmbedding[] | Embedding[];
}

// Function to normalize categories for any embedding type
function getNormalizedCategories(embedding: Embedding | NormalizedEmbedding): string[] {
  if ('categories' in embedding.metadata) {
    const categories = embedding.metadata.categories;
    if (Array.isArray(categories)) {
      return categories;
    } else if (typeof categories === 'string') {
      try {
        const parsed = JSON.parse(categories);
        return Array.isArray(parsed) ? parsed : [categories];
      } catch {
        return [categories];
      }
    }
  }
  
  if ('category' in embedding.metadata && embedding.metadata.category) {
    return [embedding.metadata.category as string];
  }
  
  return ["Uncategorized"];
}

// Function to get a color based on category
function getCategoryColor(category: string): string {
  // Simple hash function to generate a consistent color from a string
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert hash to RGB with good saturation and lightness
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 80%, 60%)`;
}

export default function Embeddings3DPlot({ embeddings }: PlotProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || embeddings.length === 0) return;

    // Extract vectors for PCA
    const vectors = embeddings.map(e => e.vector);
    
    // Use PCA to reduce dimensionality to 3D
    try {
      // Check if vectors have at least 3 dimensions
      if (vectors[0].length < 3) {
        console.error("Vectors need at least 3 dimensions for PCA");
        return;
      }
      
      const pca = new PCA(vectors);
      const reducedVectors = pca.predict(vectors, { nComponents: 3 }).to2DArray();
      
      // Create data points for each category
      const categoryMap: Record<string, {
        x: number[],
        y: number[],
        z: number[],
        text: string[],
        ids: string[],
        type: 'scatter3d',
        mode: 'markers',
        name: string,
        marker: {
          size: number,
          color: string,
          opacity: number,
        }
      }> = {};
      
      // Process each embedding
      embeddings.forEach((embedding, i) => {
        const categories = getNormalizedCategories(embedding);
        const primaryCategory = categories[0] || "Uncategorized"; // Use first category as primary
        
        // Prepare hover text with all categories
        const categoriesText = categories.join(", ");
        const truncatedText = embedding.metadata.text?.substring(0, 50) + "..." || "";
        const hoverText = `ID: ${embedding.id}<br>Categories: ${categoriesText}<br>Text: ${truncatedText}`;
      
        // Create or update data for this category
        if (!categoryMap[primaryCategory]) {
          categoryMap[primaryCategory] = {
            x: [],
            y: [],
            z: [],
            text: [],
            ids: [],
            type: 'scatter3d',
            mode: 'markers',
            name: primaryCategory,
            marker: {
              size: 6,
              color: getCategoryColor(primaryCategory),
              opacity: 0.8,
            }
          };
        }
        
        // Add this point to the category's data
        categoryMap[primaryCategory].x.push(reducedVectors[i][0]);
        categoryMap[primaryCategory].y.push(reducedVectors[i][1]);
        categoryMap[primaryCategory].z.push(reducedVectors[i][2]);
        categoryMap[primaryCategory].text.push(hoverText);
        categoryMap[primaryCategory].ids.push(embedding.id);
      });
      
      // Convert map to array of traces
      const data = Object.values(categoryMap);
      
      // Configure the plot
      const layout = {
        title: {
          text: '3D Embedding Visualization',
          font: { size: window.innerWidth < 640 ? 14 : 16 }
        },
        paper_bgcolor: 'rgba(13,18,30,0.95)',  // Lighter dark blue to match app background
        plot_bgcolor: 'rgba(13,18,30,0)',     // Transparent plot background
        scene: {
          xaxis: { 
            title: { text: 'PC1', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          yaxis: { 
            title: { text: 'PC2', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          zaxis: { 
            title: { text: 'PC3', font: { size: window.innerWidth < 640 ? 10 : 12 } },
            gridcolor: 'rgba(255,255,255,0.1)', 
            zerolinecolor: 'rgba(255,255,255,0.2)' 
          },
          bgcolor: 'rgba(13,18,30,0.95)',      // Dark navy blue background for the 3D scene to match app
        },
        margin: { 
          l: window.innerWidth < 640 ? 10 : 0, 
          r: window.innerWidth < 640 ? 10 : 0, 
          b: window.innerWidth < 640 ? 20 : 0, 
          t: window.innerWidth < 640 ? 40 : 30 
        },
        legend: {
          x: window.innerWidth < 640 ? 0 : 1,
          y: window.innerWidth < 640 ? 1 : 0.5,
          orientation: window.innerWidth < 640 ? 'h' : 'v',
          font: { size: window.innerWidth < 640 ? 8 : 10, color: 'rgba(255,255,255,0.8)' }, 
          bgcolor: 'rgba(13,18,30,0.7)'       // Semi-transparent navy background for legend
        },
        font: {
          color: 'rgba(255,255,255,0.8)'   
        }
      };
      
      // Create the plot
      PlotlyJS.newPlot(plotRef.current, data, layout, {
        responsive: true,
        displayModeBar: window.innerWidth >= 640, // Hide toolbar on mobile
        modeBarButtonsToRemove: window.innerWidth < 640 ? [] : ['pan2d', 'lasso2d', 'select2d'],
        displaylogo: false,
        scrollZoom: true,
        doubleClick: 'reset+autosize',
      });
    } catch (error) {
      console.error("Error creating 3D plot:", error);
    }
    
    // Cleanup function
    return () => {
      if (plotRef.current) {
        PlotlyJS.purge(plotRef.current);
      }
      };
  }, [embeddings]);

  return (
    <div 
      ref={plotRef} 
      className="w-full h-[300px] sm:h-[400px] lg:h-[500px] border border-muted-foreground/20 rounded-md mb-4 sm:mb-6 lg:mb-8 touch-manipulation"
      style={{ minHeight: '300px' }}
    />
  );
} 