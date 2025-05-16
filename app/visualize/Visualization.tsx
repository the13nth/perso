"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import dynamic from 'next/dynamic';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

// Import Three.js components dynamically
const ThreeComponents = dynamic(
  () => import('./ThreeComponents'),
  { 
    ssr: false,
    loading: () => null
  }
);

interface Embedding {
  id: string;
  vector: number[];
  metadata: {
    text: string;
    [key: string]: any;
  };
}

interface LoadingStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'complete' | 'error';
  progress?: number;
}

export default function ClientVisualization() {
  const [embeddings, setEmbeddings] = useState<Embedding[]>([]);
  const [error, setError] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<LoadingStep[]>([
    { id: 'init', label: 'Initializing visualization engine', status: 'pending' },
    { id: 'fetch', label: 'Fetching embeddings data', status: 'pending' },
    { id: 'process', label: 'Processing vector dimensions', status: 'pending' },
    { id: 'plot', label: 'Plotting 3D visualization', status: 'pending' },
  ]);

  // Update loading step status
  const updateStepStatus = useCallback((stepId: string, status: LoadingStep['status'], progress?: number) => {
    setLoadingSteps(steps => 
      steps.map(step => 
        step.id === stepId 
          ? { ...step, status, progress } 
          : step
      )
    );
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simulate progress for loading steps
  const simulateProgress = useCallback(async (stepId: string) => {
    let progress = 0;
    while (progress < 100) {
      await new Promise(resolve => setTimeout(resolve, 50));
      progress += Math.random() * 10;
      progress = Math.min(progress, 100);
      updateStepStatus(stepId, 'loading', progress);
    }
  }, [updateStepStatus]);

  useEffect(() => {
    async function fetchEmbeddings() {
      try {
        // Step 1: Initialize
        updateStepStatus('init', 'loading');
        await simulateProgress('init');
        updateStepStatus('init', 'complete');

        // Step 2: Fetch
        updateStepStatus('fetch', 'loading');
        const response = await fetch("/api/embeddings");
        if (!response.ok) {
          throw new Error("Failed to fetch embeddings");
        }
        const data = await response.json();
        updateStepStatus('fetch', 'complete');

        // Step 3: Process
        updateStepStatus('process', 'loading');
        await simulateProgress('process');
        setEmbeddings(data.embeddings);
        updateStepStatus('process', 'complete');

        // Step 4: Plot
        updateStepStatus('plot', 'loading');
        await simulateProgress('plot');
        updateStepStatus('plot', 'complete');

      } catch (err) {
        const errorStep = loadingSteps.find(step => step.status === 'loading');
        if (errorStep) {
          updateStepStatus(errorStep.id, 'error');
        }
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    }

    if (isClient) {
      fetchEmbeddings();
    }
  }, [isClient, loadingSteps, simulateProgress]);

  if (!isClient) {
    return null;
  }

  const isLoading = loadingSteps.some(step => 
    step.status === 'loading' || step.status === 'pending'
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-500 p-4">
        <XCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Visualization</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative">
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-center">Preparing Visualization</h2>
            <div className="space-y-4">
              {loadingSteps.map((step) => (
                <div key={step.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {step.status === 'pending' && <div className="w-4 h-4 rounded-full bg-muted" />}
                    {step.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {step.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {step.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                    <span className={cn(
                      "flex-1",
                      step.status === 'complete' && "text-muted-foreground line-through",
                      step.status === 'error' && "text-red-500"
                    )}>
                      {step.label}
                    </span>
                    {step.progress != null && (
                      <span className="text-sm text-muted-foreground">
                        {Math.round(step.progress)}%
                      </span>
                    )}
                  </div>
                  {step.status === 'loading' && (
                    <div className="h-1 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300 ease-in-out"
                        style={{ width: `${step.progress ?? 0}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      
      <Suspense fallback={null}>
        <ThreeComponents embeddings={embeddings} />
      </Suspense>
    </div>
  );
}