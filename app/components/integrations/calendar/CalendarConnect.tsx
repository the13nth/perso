'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { CalendarIcon, CheckCircle } from 'lucide-react';
import { useUser } from "@clerk/nextjs";
import { toast } from 'sonner';
import CalendarEventsModal from './CalendarEventsModal';

export default function CalendarConnect() {
  const { user } = useUser();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEventsModal, setShowEventsModal] = useState(false);

  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/calendar/status');
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (_error) {
      console.error('Error checking calendar connection:', _error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/integrations/calendar/auth', {
        method: 'POST'
      });
      const data = await response.json();

      if (data.authUrl) {
        // Open popup for authentication
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          'Connect Calendar',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Poll for popup closure
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            checkConnectionStatus();
            setIsLoading(false);
          }
        }, 500);
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (_error) {
      console.error('Error connecting calendar:', _error);
      toast.error('Failed to initialize calendar connection');
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      await fetch('/api/integrations/calendar/disconnect', { method: 'POST' });
      setIsConnected(false);
      toast.success('Calendar disconnected successfully');
    } catch (_error) {
      console.error('Error disconnecting calendar:', _error);
      toast.error('Failed to disconnect calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDebug = () => {
    setShowEventsModal(true);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-sm text-gray-500">
            Please sign in to access calendar integration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-[#2a2b3c] bg-[#1a1c2e] shadow-none">
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-2xl text-white">
            <CalendarIcon className="h-8 w-8" />
            Connect Calendar Account
          </CardTitle>
          <CardDescription className="text-base text-gray-400">
            Connect your Google Calendar to enable calendar analysis and insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {isConnected && (
            <div className="mb-4 rounded bg-[#1d2032] p-4">
              <div className="flex items-center gap-2 text-[#4f87ff]">
                <CheckCircle className="h-5 w-5" />
                <span>Connected</span>
              </div>
              <p className="mt-1 text-sm text-[#4f87ff]">
                Your calendar account is successfully connected.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {isConnected ? (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isLoading ? 'Processing...' : 'Disconnect Calendar'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDebug}
                  className="border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Debug: Show Events
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Connect Calendar'}
              </Button>
            )}

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-gray-300">
                What this integration enables:
              </h3>
              <ul className="list-inside space-y-2 text-sm text-gray-400">
                <li>• Analysis of calendar patterns and scheduling trends</li>
                <li>• Automated event categorization and organization</li>
                <li>• Insights into meeting frequency and time management</li>
                <li>• Schedule optimization and availability tracking</li>
              </ul>
              {isConnected && (
                <p className="mt-4 text-sm text-gray-400">
                  We only request read access to your calendar. You can revoke access at any time through your Google
                  Account settings or by clicking the Disconnect button above.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarEventsModal 
        open={showEventsModal}
        onOpenChange={setShowEventsModal}
      />
    </>
  );
} 