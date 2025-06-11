"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

interface Metadata {
  text: string;
  categories: string[];
  title?: string;
  chunkIndex?: number;
  totalChunks?: number;
  createdAt?: string | number;
  access?: string;
  [key: string]: string | string[] | number | boolean | undefined;
}

interface Point {
  id: string;
  vector: number[];
  metadata: Metadata;
}

interface PlotData {
  points: Point[];
  categories: string[];
}

interface PlotProps {
  data: PlotData;
}

export default function Embeddings3DPlot({ data }: PlotProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [pointCount, setPointCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  // Process data to get counts
  useEffect(() => {
    if (data) {
      // Simple data processing - just count points and categories
      setPointCount(data.points?.length || 0);
      setCategoryCount(data.categories?.length || 0);
      setIsLoading(false);
    }
  }, [data]);

  // Download data as JSON
  const downloadData = () => {
    if (!data) return;
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'embeddings_data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative h-[400px] flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200">
      {isLoading ? (
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <div className="text-sm text-gray-600">
            Processing data...
          </div>
        </div>
      ) : (
        <div className="text-center max-w-md p-6">
          <h3 className="text-lg font-medium mb-2">Embeddings Data Summary</h3>
          <p className="text-sm text-gray-600 mb-4">
            Visualization has been disabled to prevent browser freezing.
          </p>
          
          <div className="bg-white p-4 rounded-md shadow-sm mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-left">
                <p className="text-xs text-gray-500">Points</p>
                <p className="text-lg font-semibold">{pointCount.toLocaleString()}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-500">Categories</p>
                <p className="text-lg font-semibold">{categoryCount}</p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={downloadData}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Data as JSON
          </Button>
        </div>
      )}
    </div>
  );
}
