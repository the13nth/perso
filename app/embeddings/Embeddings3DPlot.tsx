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
  // Predefined colors for common categories - using hex format
  const predefinedColors: Record<string, string> = {
    'general': '#3B82F6',      // Blue
    'health': '#10B981',       // Green
    'routines': '#F59E0B',     // Orange
    'goals': '#8B5CF6',        // Purple
    'science': '#EF4444',      // Red
    'notes': '#06B6D4',        // Cyan
    'documents': '#F97316',    // Orange
    'activities': '#84CC16',   // Lime
    'comprehensive_activity': '#84CC16', // Lime
    'physical': '#F97316',     // Orange
    'work': '#3B82F6',         // Blue
    'study': '#10B981',        // Green
    'routine': '#8B5CF6',      // Purple
    'uncategorized': '#6B7280' // Gray
  };

  // Check if we have a predefined color for this category
  const lowerCategory = category.toLowerCase();
  if (predefinedColors[lowerCategory]) {
    console.log(`Found predefined color for '${category}': ${predefinedColors[lowerCategory]}`);
    return predefinedColors[lowerCategory];
  }

  // Generate a consistent color from category name using improved hash
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use golden ratio to get well-distributed hues
  const goldenRatio = 0.618033988749895;
  const hue = (Math.abs(hash) * goldenRatio) % 1;
  
  // Convert to HSL with high saturation and good lightness for visibility
  const h = Math.floor(hue * 360);
  const s = 75 + (Math.abs(hash) % 20); // 75-95% saturation
  const l = 50 + (Math.abs(hash) % 20); // 50-70% lightness
  
  // Convert HSL to hex instead of returning HSL string
  const rgb = hslToRgb(h, s, l);
  const hexColor = rgbToHex(rgb.r, rgb.g, rgb.b);
  
  console.log(`Generated color for '${category}': HSL(${h}, ${s}%, ${l}%) -> ${hexColor}`);
  return hexColor;
}

// Color blending utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
  };
}

function parseColorToRgb(color: string): { r: number; g: number; b: number } | null {
  console.log(`Parsing color: ${color}`);
  
  // Handle hex colors
  if (color.startsWith('#')) {
    const result = hexToRgb(color);
    console.log(`Hex ${color} parsed to:`, result);
    return result;
  }
  
  // Handle HSL colors - more flexible regex
  const hslMatch = color.match(/hsl\s*\(\s*(\d+)\s*,\s*(\d+)\s*%\s*,\s*(\d+)\s*%\s*\)/i);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]);
    const s = parseInt(hslMatch[2]);
    const l = parseInt(hslMatch[3]);
    console.log(`HSL values: h=${h}, s=${s}, l=${l}`);
    const result = hslToRgb(h, s, l);
    console.log(`HSL ${color} converted to RGB:`, result);
    return result;
  }
  
  // Handle RGB colors
  const rgbMatch = color.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (rgbMatch) {
    const result = {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3])
    };
    console.log(`RGB ${color} parsed to:`, result);
    return result;
  }
  
  console.warn(`Could not parse color: ${color}`);
  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendColors(colors: string[]): string {
  if (colors.length === 0) return '#6B7280'; // Default gray
  if (colors.length === 1) return colors[0];
  
  console.log(`Blending colors:`, colors);
  
  // Convert all colors to RGB
  const rgbColors = colors.map(color => {
    const rgb = parseColorToRgb(color);
    console.log(`Color ${color} -> RGB:`, rgb);
    return rgb;
  }).filter(Boolean) as { r: number; g: number; b: number }[];
  
  console.log(`Successfully parsed ${rgbColors.length} out of ${colors.length} colors`);
  
  if (rgbColors.length === 0) return '#6B7280';
  if (rgbColors.length === 1) return rgbToHex(rgbColors[0].r, rgbColors[0].g, rgbColors[0].b);
  
  // Calculate weighted average (you could also do other blending modes)
  const totalR = rgbColors.reduce((sum, color) => sum + color.r, 0);
  const totalG = rgbColors.reduce((sum, color) => sum + color.g, 0);
  const totalB = rgbColors.reduce((sum, color) => sum + color.b, 0);
  
  const avgR = totalR / rgbColors.length;
  const avgG = totalG / rgbColors.length;
  const avgB = totalB / rgbColors.length;
  
  const result = rgbToHex(avgR, avgG, avgB);
  console.log(`Blended ${rgbColors.length} colors to: ${result}`);
  return result;
}

// Function to get blended color for multiple categories
function getCategoryBlendedColor(categories: string[]): string {
  console.log(`getCategoryBlendedColor called with:`, categories);
  
  if (categories.length === 0) {
    console.log(`No categories, returning uncategorized color`);
    return getCategoryColor("Uncategorized");
  }
  
  if (categories.length === 1) {
    const singleColor = getCategoryColor(categories[0]);
    console.log(`Single category '${categories[0]}' -> ${singleColor}`);
    return singleColor;
  }
  
  // Get colors for all categories
  const categoryColors = categories.map(category => {
    const color = getCategoryColor(category);
    console.log(`Category '${category}' -> ${color}`);
    return color;
  });
  
  console.log(`Categories: [${categories.join(', ')}] -> Individual colors:`, categoryColors);
  
  // Blend the colors
  const blended = blendColors(categoryColors);
  console.log(`Final blended result: ${blended}`);
  return blended;
}

export default function Embeddings3DPlot({ embeddings }: PlotProps) {
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!plotRef.current || embeddings.length === 0) return;

    console.log(`Processing ${embeddings.length} embeddings for 3D plot`);

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
      
      // Prepare data for plotting with individual colors per point
      const x: number[] = [];
      const y: number[] = [];
      const z: number[] = [];
      const text: string[] = [];
      const colors: string[] = [];
      const ids: string[] = [];
      
      // Process each embedding
      embeddings.forEach((embedding, i) => {
        const categories = getNormalizedCategories(embedding);
        console.log(`Embedding ${i}: ID=${embedding.id.substring(0, 8)}..., Categories=[${categories.join(', ')}]`);
        
        // Get blended color for all categories
        const blendedColor = getCategoryBlendedColor(categories);
        console.log(`Final color for embedding ${i}: ${blendedColor}`);
        
        // Prepare hover text with all categories
        const categoriesText = categories.join(", ");
        const truncatedText = embedding.metadata.text?.substring(0, 50) + "..." || "";
        const hoverText = `ID: ${embedding.id}<br>Categories: ${categoriesText}<br>Text: ${truncatedText}`;
        
        // Add data point
        x.push(reducedVectors[i][0]);
        y.push(reducedVectors[i][1]);
        z.push(reducedVectors[i][2]);
        text.push(hoverText);
        colors.push(blendedColor);
        ids.push(embedding.id);
      });
      
      console.log(`Generated ${colors.length} colors:`, colors.slice(0, 10)); // Log first 10 colors
      
      // Convert hex colors to RGB format for better Plotly compatibility
      const rgbColors = colors.map(color => {
        const rgb = parseColorToRgb(color);
        if (rgb) {
          return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        }
        return 'rgb(107, 114, 128)'; // Default gray
      });
      
      console.log(`Converted to RGB format:`, rgbColors.slice(0, 5));
      
      // Create single trace with individual colors
      const data = [{
        x: x,
        y: y,
        z: z,
        text: text,
        ids: ids,
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        name: 'Embeddings',
        marker: {
          size: 8, // Slightly larger for better visibility
          color: rgbColors, // Use RGB format instead of hex
          colorscale: undefined, // Disable colorscale to use individual colors
          showscale: false, // Don't show color scale
          opacity: 0.9,
          line: {
            color: 'rgba(255,255,255,0.3)',
            width: 2
          }
        },
        hovertemplate: '%{text}<extra></extra>',
        showlegend: false
      }];
      
      console.log(`3D Plot: Created plot with ${embeddings.length} points using individual blended colors`);
      console.log('Data structure for Plotly:', {
        pointCount: data[0].x.length,
        colorCount: data[0].marker.color.length,
        sampleColors: data[0].marker.color.slice(0, 5),
        markerConfig: data[0].marker
      });
      
      // Configure the plot
      const layout = {
        title: {
          text: '3D Embedding Visualization (Color-Blended Categories)',
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
        showlegend: false, // Hide legend since each point has individual color
        font: {
          color: 'rgba(255,255,255,0.8)'   
        },
        annotations: [{
          x: 0.02,
          y: 0.98,
          xref: 'paper',
          yref: 'paper',
          text: 'Multi-category embeddings show blended colors',
          showarrow: false,
          font: { size: 10, color: 'rgba(255,255,255,0.6)' },
          bgcolor: 'rgba(13,18,30,0.8)',
          bordercolor: 'rgba(255,255,255,0.2)',
          borderwidth: 1
        }]
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