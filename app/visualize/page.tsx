"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const ClientVisualization = dynamic(
  () => import('./Visualization').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center min-h-screen">
        Loading visualization...
      </div>
    )
  }
);

export default function VisualizePage() {
  return (
    <div className="w-full h-screen bg-background">
      <Suspense 
        fallback={
          <div className="flex justify-center items-center min-h-screen">
            <div className="text-foreground">
              Initializing 3D visualization...
            </div>
          </div>
        }
      >
        <ClientVisualization />
      </Suspense>
    </div>
  );
} 