'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Loader2, Users } from 'lucide-react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  attendees: number;
  description: string;
  location: string;
  status: string;
  isRecurring: boolean;
}

interface EventsResponse {
  events: CalendarEvent[];
  status: {
    totalEvents: number;
    timeRange: string;
  };
}

export default function CalendarDebugPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<EventsResponse | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/integrations/calendar/debug');
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      const data = await response.json();
      setData(data);
    } catch (_error) {
      setError(_error instanceof Error ? _error.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="container max-w-4xl py-6">
        <Card className="border border-[#2a2b3c] bg-[#1a1c2e]">
          <CardContent className="pt-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
            <p className="mt-2 text-sm text-gray-400">Loading calendar events...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl py-6">
        <Card className="border border-[#2a2b3c] bg-[#1a1c2e]">
          <CardContent className="pt-6 text-center">
            <p className="text-red-400">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6">
      <Card className="border border-[#2a2b3c] bg-[#1a1c2e]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CalendarIcon className="h-6 w-6" />
            Calendar Events Debug
          </CardTitle>
          <CardDescription>
            Showing {data?.status.totalEvents} events from {data?.status.timeRange}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.events.map((event) => (
              <div
                key={event.id}
                className="rounded-lg border border-gray-800 bg-[#1d2032] p-4"
              >
                <div className="mb-2 flex items-start justify-between">
                  <h3 className="font-medium text-white">{event.summary}</h3>
                  {event.attendees > 0 && (
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Users className="h-4 w-4" />
                      <span>{event.attendees}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Start: {formatDateTime(event.start)}</p>
                  <p>End: {formatDateTime(event.end)}</p>
                  {event.location && <p>Location: {event.location}</p>}
                  {event.description && (
                    <p className="mt-2 text-sm text-gray-500">{event.description}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    {event.isRecurring && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs text-blue-400">
                        Recurring
                      </span>
                    )}
                    <span className="rounded-full bg-gray-500/10 px-2 py-1 text-xs text-gray-400">
                      {event.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 