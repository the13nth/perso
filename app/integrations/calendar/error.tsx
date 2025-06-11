'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Calendar integration error:', error);
  }, [error]);

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Something went wrong!</h2>
        <p className="text-gray-600 mb-4">
          There was an error loading the calendar integration.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
} 