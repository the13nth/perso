"use client";

import { useRef, useEffect, useMemo } from "react";
import * as PlotlyJS from 'plotly.js-dist-min';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NormalizedEmbedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    categories: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

interface EmbeddingAnalyticsProps {
  embeddings: NormalizedEmbedding[];
}

export default function EmbeddingAnalytics({ embeddings }: EmbeddingAnalyticsProps) {
  const normDistRef = useRef<HTMLDivElement>(null);
  const categoryDistRef = useRef<HTMLDivElement>(null);
  const textLengthRef = useRef<HTMLDivElement>(null);
  const dimensionCorrelationRef = useRef<HTMLDivElement>(null);
  const wordFrequencyRef = useRef<HTMLDivElement>(null);

  // Calculate analytics data
  const analyticsData = useMemo(() => {
    if (embeddings.length === 0) return null;

    // Vector norm analysis
    const vectorNorms = embeddings.map(e => 
      Math.sqrt(e.vector.reduce((sum, v) => sum + v * v, 0))
    );

    // Category distribution
    const categoryCount: Record<string, number> = {};
    embeddings.forEach(e => {
      e.metadata.categories.forEach(cat => {
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
    });

    // Text length analysis
    const textLengths = embeddings.map(e => 
      (e.metadata.text || "").length
    );

    // Word frequency analysis
    const wordCounts: Record<string, number> = {};
    embeddings.forEach(e => {
      const words = (e.metadata.text || "")
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
      
      words.forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });

    // Get top words
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Dimension variance analysis
    const dimensions = embeddings[0].vector.length;
    const dimensionVariances = new Array(Math.min(50, dimensions)).fill(0).map((_, dimIndex) => {
      const dimValues = embeddings.map(e => e.vector[dimIndex]);
      const mean = dimValues.reduce((sum, v) => sum + v, 0) / dimValues.length;
      const variance = dimValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / dimValues.length;
      return { dimension: dimIndex + 1, variance };
    });

    return {
      vectorNorms,
      categoryCount,
      textLengths,
      topWords,
      dimensionVariances,
      totalEmbeddings: embeddings.length,
      avgVectorLength: dimensions,
      minNorm: Math.min(...vectorNorms),
      maxNorm: Math.max(...vectorNorms),
      meanNorm: vectorNorms.reduce((sum, n) => sum + n, 0) / vectorNorms.length,
      medianTextLength: textLengths.sort((a, b) => a - b)[Math.floor(textLengths.length / 2)],
      avgTextLength: textLengths.reduce((sum, l) => sum + l, 0) / textLengths.length
    };
  }, [embeddings]);

  useEffect(() => {
    if (!analyticsData || embeddings.length === 0) return;

    // Plot theme configuration
    const plotConfig = {
      responsive: true,
      displayModeBar: false,
      displaylogo: false,
    };

    const plotLayout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: 'rgba(255,255,255,0.8)', size: 12 },
      margin: { l: 50, r: 20, t: 40, b: 40 },
    };

    // 1. Vector Norm Distribution
    if (normDistRef.current) {
      const normData = [{
        x: analyticsData.vectorNorms,
        type: 'histogram',
        marker: {
          color: 'rgba(59, 130, 246, 0.7)',
          line: { color: 'rgba(59, 130, 246, 1)', width: 1 }
        },
        nbinsx: 20,
      }];

      PlotlyJS.newPlot(normDistRef.current, normData, {
        ...plotLayout,
        title: { text: 'Vector Norm Distribution', font: { size: 14 } },
        xaxis: { title: 'Vector Norm', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Frequency', gridcolor: 'rgba(255,255,255,0.1)' },
      }, plotConfig);
    }

    // 2. Category Distribution
    if (categoryDistRef.current) {
      const categories = Object.keys(analyticsData.categoryCount);
      const counts = Object.values(analyticsData.categoryCount);
      
      const categoryData = [{
        labels: categories,
        values: counts,
        type: 'pie',
        marker: {
          colors: categories.map((_, i) => 
            `hsl(${(i * 137.5) % 360}, 70%, 60%)`
          )
        },
        textinfo: 'label+percent',
        textfont: { size: 10 },
      }];

      PlotlyJS.newPlot(categoryDistRef.current, categoryData, {
        ...plotLayout,
        title: { text: 'Category Distribution', font: { size: 14 } },
        showlegend: false,
      }, plotConfig);
    }

    // 3. Text Length Distribution
    if (textLengthRef.current) {
      const textLengthData = [{
        x: analyticsData.textLengths,
        type: 'histogram',
        marker: {
          color: 'rgba(16, 185, 129, 0.7)',
          line: { color: 'rgba(16, 185, 129, 1)', width: 1 }
        },
        nbinsx: 20,
      }];

      PlotlyJS.newPlot(textLengthRef.current, textLengthData, {
        ...plotLayout,
        title: { text: 'Text Length Distribution', font: { size: 14 } },
        xaxis: { title: 'Text Length (characters)', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Frequency', gridcolor: 'rgba(255,255,255,0.1)' },
      }, plotConfig);
    }

    // 4. Dimension Variance Analysis
    if (dimensionCorrelationRef.current) {
      const dimData = [{
        x: analyticsData.dimensionVariances.map(d => d.dimension),
        y: analyticsData.dimensionVariances.map(d => d.variance),
        type: 'bar',
        marker: {
          color: 'rgba(245, 101, 101, 0.7)',
          line: { color: 'rgba(245, 101, 101, 1)', width: 1 }
        },
      }];

      PlotlyJS.newPlot(dimensionCorrelationRef.current, dimData, {
        ...plotLayout,
        title: { text: 'Embedding Dimension Variance (First 50)', font: { size: 14 } },
        xaxis: { title: 'Dimension', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Variance', gridcolor: 'rgba(255,255,255,0.1)' },
      }, plotConfig);
    }

    // 5. Word Frequency
    if (wordFrequencyRef.current) {
      const wordData = [{
        x: analyticsData.topWords.map(w => w[1]),
        y: analyticsData.topWords.map(w => w[0]),
        type: 'bar',
        orientation: 'h',
        marker: {
          color: 'rgba(139, 92, 246, 0.7)',
          line: { color: 'rgba(139, 92, 246, 1)', width: 1 }
        },
      }];

      PlotlyJS.newPlot(wordFrequencyRef.current, wordData, {
        ...plotLayout,
        title: { text: 'Top 20 Word Frequency', font: { size: 14 } },
        xaxis: { title: 'Frequency', gridcolor: 'rgba(255,255,255,0.1)' },
        yaxis: { title: 'Words', gridcolor: 'rgba(255,255,255,0.1)' },
        height: 500,
      }, plotConfig);
    }

  }, [analyticsData, embeddings]);

  if (!analyticsData || embeddings.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium mb-2">No Data Available</h3>
        <p className="text-muted-foreground">Upload some embeddings to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Embeddings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalEmbeddings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Vector Dimension</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgVectorLength}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mean Vector Norm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.meanNorm.toFixed(3)}</div>
            <div className="text-xs text-muted-foreground">
              Range: {analyticsData.minNorm.toFixed(3)} - {analyticsData.maxNorm.toFixed(3)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Text Length</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(analyticsData.avgTextLength)}</div>
            <div className="text-xs text-muted-foreground">
              Median: {analyticsData.medianTextLength} chars
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vector Norm Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vector Norm Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={normDistRef} className="h-64" />
            <p className="text-xs text-muted-foreground mt-2">
              Distribution of embedding vector magnitudes. Higher norms may indicate more &quot;activated&quot; embeddings.
            </p>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={categoryDistRef} className="h-64" />
            <p className="text-xs text-muted-foreground mt-2">
              Breakdown of embeddings by category. Shows content distribution across different types.
            </p>
          </CardContent>
        </Card>

        {/* Text Length Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Text Length Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={textLengthRef} className="h-64" />
            <p className="text-xs text-muted-foreground mt-2">
              Distribution of text lengths. Helps understand content complexity and chunking effectiveness.
            </p>
          </CardContent>
        </Card>

        {/* Dimension Variance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Embedding Dimensions</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={dimensionCorrelationRef} className="h-64" />
            <p className="text-xs text-muted-foreground mt-2">
              Variance across embedding dimensions. Higher variance dimensions contain more discriminative information.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Word Frequency Chart - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={wordFrequencyRef} className="h-96" />
          <p className="text-xs text-muted-foreground mt-2">
            Most frequent words across all embeddings. Reveals key themes and topics in your content.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 