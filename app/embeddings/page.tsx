"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

const ClientVisualization = dynamic(
  () => import('./Visualization').then(mod => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="text-center">
          <div className="text-base sm:text-lg text-foreground">Loading visualization...</div>
        </div>
      </div>
    )
  }
);

export default function VisualizePage() {
  const { isLoaded, isSignedIn } = useAuth();

  // Show loading state while auth is being checked
  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="text-center">
          <div className="text-base sm:text-lg text-foreground">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    redirect('/sign-in');
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <Suspense 
        fallback={
          <div className="flex justify-center items-center min-h-screen px-4">
            <div className="text-center">
              <div className="text-base sm:text-lg text-foreground">
                Initializing 3D visualization...
              </div>
            </div>
          </div>
        }
      >
        <ClientVisualization />
      </Suspense>
    </div>
  );
} 