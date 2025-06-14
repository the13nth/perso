"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

const ClientVisualization = dynamic(
  () => import('./Visualization'),
  { ssr: false }
);

export default function VisualizePage() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen px-4">
        <div className="text-center">
          <div className="text-base sm:text-lg text-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    redirect('/sign-in');
  }

  return (
    <div className="w-full min-h-screen bg-background">
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-screen px-4">
          <div className="text-center">
            <div className="text-base sm:text-lg text-foreground">Loading...</div>
          </div>
        </div>
      }>
        <ClientVisualization />
      </Suspense>
    </div>
  );
}
