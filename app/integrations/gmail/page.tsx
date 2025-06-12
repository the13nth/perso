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
  date: string; // human-readable date string
  body?: string;    // full body when available
  snippet?: string; // fallback preview
  isIngesting?: boolean; // Track ingestion state
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
      
      // Map API response to local Email shape so we always have date & body/snippet fields
      const mapped: Email[] = (data.emails as any[]).map((e) => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        date: e.receivedDate ?? e.date ?? "", // the API uses receivedDate
        body: e.body,
        snippet: e.snippet,
      }));

      setEmails(mapped);
      console.log(data.emails);
      setIsDebugModalOpen(true);
    } catch (_error) {
      console.error("Error fetching emails:", _error);
      setError(_error instanceof Error ? _error.message : "Failed to fetch emails");
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleIngestEmail = async (emailId: string, emailData: Email) => {
    // Update loading state for this specific email
    setEmails(prev => prev.map(e => 
      e.id === emailId ? { ...e, isIngesting: true } : e
    ));

    try {
      // Create a rich metadata summary for this specific email
      const summary = `
Subject: ${emailData.subject}
From: ${emailData.from}
Date: ${emailData.date}

${emailData.body || emailData.snippet || "No content available"}
`.trim();

      const response = await fetch('/api/retrieval/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          content: summary,
          metadata: {
            emailId,
            from: emailData.from,
            subject: emailData.subject,
            date: emailData.date,
            categories: ['Emails', 'Gmail', 'Communication'],
            access: 'personal',
            source: 'gmail',
            type: 'single_email'
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to ingest email');
      }

      // Update success state
      setEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, isIngesting: false } : e
      ));
    } catch (_error) {
      console.error('Error ingesting email:', _error);
      // Reset loading state on error
      setEmails(prev => prev.map(e => 
        e.id === emailId ? { ...e, isIngesting: false } : e
      ));
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
              Showing the most recent emails from your Gmail account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {emails.map((email) => (
              <Card key={email.id} className="p-4">
                <div className="space-y-2">
                  {email.from && (
                    <p className="text-sm font-medium text-muted-foreground">
                      {email.from}
                    </p>
                  )}
                  {email.subject && (
                    <p className="text-sm font-semibold">
                      {email.subject}
                    </p>
                  )}
                  {(email.body || email.snippet) && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-40 overflow-auto">
                      {email.body || email.snippet}
                    </p>
                  )}
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleIngestEmail(email.id, email)}
                      disabled={email.isIngesting}
                    >
                      {email.isIngesting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Ingesting...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Ingest Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 