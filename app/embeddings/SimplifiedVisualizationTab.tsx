import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface Point3D {
  x: number;
  y: number;
  z: number;
  type: 'document' | 'note' | 'activity';
  category: string;
  metadata: {
    id: string;
    title: string;
    text: string;
  };
}

interface SimplifiedVisualizationTabProps {
  documents: any[]; // Replace with proper type
  notes: any[]; // Replace with proper type
  activities: any[]; // Replace with proper type
}

export default function SimplifiedVisualizationTab({ documents, notes, activities }: SimplifiedVisualizationTabProps) {
  const [points, setPoints] = useState<Point3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  const fetchSimplifiedVisualizationData = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error state
      const response = await fetch('/api/embeddings/visualization/simplified');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch data (${response.status})`);
      }
      
      const data = await response.json();
      
      if (!data.points || !Array.isArray(data.points)) {
        throw new Error('Invalid data format received');
      }
      
      if (data.points.length === 0) {
        setPoints([]);
        return;
      }
      
      setPoints(data.points);
    } catch (err) {
      console.error('Error fetching simplified visualization data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimplifiedVisualizationData();
  }, [documents, notes, activities]);

  // Get unique categories from points
  const categories = useMemo(() => {
    const uniqueCategories = new Set(points.map(p => p.category));
    return Array.from(uniqueCategories).sort();
  }, [points]);

  // Initialize selected categories when points change
  useEffect(() => {
    if (points.length > 0 && selectedCategories.size === 0) {
      setSelectedCategories(new Set(categories));
    }
  }, [points, categories]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Generate a consistent color for each category
  const getCategoryColor = (category: string) => {
    // Hash the category string to a number
    const hash = category.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    // Convert hash to RGB
    const r = (hash & 0xFF0000) >> 16;
    const g = (hash & 0x00FF00) >> 8;
    const b = hash & 0x0000FF;
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const filteredPoints = points.filter(point => selectedCategories.has(point.category));

  const plotData = [
    {
      type: 'scatter3d',
      mode: 'markers',
      x: filteredPoints.map(p => p.x),
      y: filteredPoints.map(p => p.y),
      z: filteredPoints.map(p => p.z),
      marker: {
        size: 8,
        color: filteredPoints.map(p => getCategoryColor(p.category)),
      },
      text: filteredPoints.map(p => `${p.metadata.title} (${p.category})\n${p.metadata.text}`),
      hoverinfo: 'text',
    }
  ];

  const layout = {
    margin: { l: 0, r: 0, b: 0, t: 0 },
    scene: {
      xaxis: { title: 'X' },
      yaxis: { title: 'Y' },
      zaxis: { title: 'Z' },
    },
    showlegend: false,
    height: 600,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">Loading simplified visualization...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center min-h-[600px]">
          <div className="text-center">
            <div className="text-sm text-destructive mb-2">{error}</div>
            <Button onClick={fetchSimplifiedVisualizationData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <CardTitle className="text-base sm:text-lg">Simplified Embeddings View</CardTitle>
        <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:max-w-[70%]">
          {categories.map(category => (
            <Badge 
              key={category}
              variant={selectedCategories.has(category) ? 'default' : 'outline'}
              className="cursor-pointer text-xs sm:text-sm"
              onClick={() => toggleCategory(category)}
              style={{
                backgroundColor: selectedCategories.has(category) ? getCategoryColor(category) : 'transparent',
                borderColor: getCategoryColor(category),
                color: selectedCategories.has(category) ? '#fff' : 'inherit'
              }}
            >
              {category}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] sm:h-[600px] w-full">
          <Plot
            data={plotData}
            layout={{
              ...layout,
              height: undefined,
              autosize: true,
              margin: { l: 0, r: 0, b: 0, t: 0 },
              scene: {
                ...layout.scene,
                camera: {
                  eye: { x: 1.5, y: 1.5, z: 1.5 }
                }
              }
            }}
            config={{ 
              displayModeBar: true,
              responsive: true,
              displaylogo: false,
              modeBarButtonsToRemove: ['toImage', 'sendDataToCloud']
            }}
            className="w-full h-full"
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </CardContent>
    </Card>
  );
} 