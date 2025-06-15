"use client";

import { useEffect, useState } from 'react';
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
  metadata: {
    id: string;
    title: string;
    text: string;
  };
}

interface VisualizationTabProps {
  documents: any[]; // Replace with proper type
  notes: any[]; // Replace with proper type
  activities: any[]; // Replace with proper type
}

export default function VisualizationTab({ documents, notes, activities }: VisualizationTabProps) {
  const [points, setPoints] = useState<Point3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['document', 'note', 'activity']));

  useEffect(() => {
    fetchVisualizationData();
  }, [documents, notes, activities]);

  const fetchVisualizationData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/embeddings/visualization');
      if (!response.ok) {
        throw new Error('Failed to fetch visualization data');
      }
      const data = await response.json();
      setPoints(data.points);
    } catch (err) {
      console.error('Error fetching visualization data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filteredPoints = points.filter(point => selectedTypes.has(point.type));

  const plotData = [
    {
      type: 'scatter3d',
      mode: 'markers',
      x: filteredPoints.map(p => p.x),
      y: filteredPoints.map(p => p.y),
      z: filteredPoints.map(p => p.z),
      marker: {
        size: 6,
        color: filteredPoints.map(p => 
          p.type === 'document' ? '#2563eb' : 
          p.type === 'note' ? '#16a34a' : 
          '#dc2626'
        ),
      },
      text: filteredPoints.map(p => `${p.metadata.title} (${p.type})\n${p.metadata.text}`),
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
            <div className="text-sm text-muted-foreground">Loading visualization...</div>
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
            <Button onClick={fetchVisualizationData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Embeddings Visualization</CardTitle>
        <div className="flex gap-2">
          <Badge 
            variant={selectedTypes.has('document') ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggleType('document')}
          >
            Documents
          </Badge>
          <Badge 
            variant={selectedTypes.has('note') ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggleType('note')}
          >
            Notes
          </Badge>
          <Badge 
            variant={selectedTypes.has('activity') ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => toggleType('activity')}
          >
            Activities
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[600px] w-full">
          <Plot
            data={plotData}
            layout={layout}
            config={{ 
              displayModeBar: true,
              responsive: true,
            }}
            className="w-full h-full"
          />
        </div>
      </CardContent>
    </Card>
  );
} 