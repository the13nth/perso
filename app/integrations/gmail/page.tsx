"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, AlertCircle, CheckCircle2, XCircle, Bug, Loader2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  content: string;
}

export default function GmailIntegrationPage() {
  const { isSignedIn } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);

  // Check connection status on mount and after navigation
  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const response = await fetch("/api/integrations/gmail/status");
        const { connected } = await response.json();
        setSuccess(connected);
      } catch (_error) {
        console.error("Error checking Gmail connection status:", error);
        setError("Failed to check Gmail connection status");
      } finally {
        setIsCheckingStatus(false);
      }
    };

    if (isSignedIn) {
      checkConnectionStatus();
    }
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <div className="container max-w-4xl py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unauthorized</AlertTitle>
          <AlertDescription>Please sign in to access Gmail integration.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleGmailConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Initialize OAuth flow
      const response = await fetch("/api/integrations/gmail/auth", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to initialize Gmail connection");
      }
      
      const { authUrl } = await response.json();
      
      // Open Google OAuth consent screen in a popup
      const width = 600;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        "Connect Gmail",
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch("/api/integrations/gmail/status");
          const { connected } = await statusResponse.json();
          
          if (connected) {
            clearInterval(pollInterval);
            if (popup) popup.close();
            setSuccess(true);
          }
        } catch (_error) {
          console.error("Error checking status:", error);
        }
      }, 2000);

      // Cleanup interval if popup closes
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollInterval);
          clearInterval(checkClosed);
          setIsConnecting(false);
        }
      }, 500);

    } catch (_error) {
      console.error("Error connecting Gmail:", _error);
      setError(_error instanceof Error ? _error.message : "Failed to connect Gmail");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch("/api/integrations/gmail/disconnect", {
        method: "POST",
      });
      
      if (!response.ok) {
        throw new Error("Failed to disconnect Gmail");
      }
      
      setSuccess(false);
    } catch (_error) {
      console.error("Error disconnecting Gmail:", error);
      setError(_error instanceof Error ? _error.message : "Failed to disconnect Gmail");
    }
  };

  const handleDebugFetch = async () => {
    setIsLoadingEmails(true);
    setError(null);
    
    try {
      const response = await fetch("/api/integrations/gmail/debug");
      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      setEmails(data.emails);
      console.log(data.emails);
      setIsDebugModalOpen(true);
    } catch (_error) {
      console.error("Error fetching emails:", _error);
      setError(_error instanceof Error ? _error.message : "Failed to fetch emails");
    } finally {
      setIsLoadingEmails(false);
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gmail Integration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Connect Gmail Account
          </CardTitle>
          <CardDescription>
            Connect your Gmail account to enable email analysis and insights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isCheckingStatus ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : success ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>Connected</AlertTitle>
                <AlertDescription>
                  Your Gmail account is successfully connected.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  className="w-full sm:w-auto"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Disconnect Gmail
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleDebugFetch}
                  disabled={isLoadingEmails}
                  className="w-full sm:w-auto"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  {isLoadingEmails ? "Loading..." : "Debug: Show Emails"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleGmailConnect}
              disabled={isConnecting}
              className="w-full sm:w-auto"
            >
              {isConnecting ? (
                <>
                  <span className="animate-spin mr-2">⭮</span>
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </Button>
          )}

          <div className="mt-6 space-y-2">
            <h3 className="font-medium">What this integration enables:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>Analysis of email patterns and communication trends</li>
              <li>Automated categorization of emails</li>
              <li>Insights into email response times and engagement</li>
              <li>Search and retrieval across your email history</li>
            </ul>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              We only request read access to your emails. You can revoke access at any time
              through your Google Account settings or by clicking the Disconnect button above.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDebugModalOpen} onOpenChange={setIsDebugModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Debug: Email Headers Preview</DialogTitle>
            <DialogDescription>
              Showing metadata for the latest {emails.length} emails from your inbox
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {emails.map((email) => (
              <div key={email.id} className="border rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold">{email.subject}</h3>
                    <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">{email.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{email.from}</p>
                  <p className="text-sm italic text-muted-foreground">{email.content}</p>
                </div>
              </div>
            ))}
            
            {emails.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No emails found in inbox
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 