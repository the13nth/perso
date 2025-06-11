"use client";

import { useState, Suspense, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentChatInterface } from "@/components/AgentChatInterface";
import { Bot, ArrowLeft, MessageSquare, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

// Default fallback questions when generation fails
const DEFAULT_QUESTIONS = [
  "What is your main purpose?",
  "What specific tasks can you help with?",
  "Can you show me an example of your capabilities?"
];

// Types for better type safety
interface ExampleQuestionsProps {
  agentId: string;
  onAskQuestion: (question: string) => void;
}

interface QuestionResponse {
  success: boolean;
  questions: string[];
  fallback?: boolean;
  clarified?: boolean;
  error?: string;
}

/**
 * Component to display example questions for the agent
 */
function ExampleQuestions({ agentId, onAskQuestion }: ExampleQuestionsProps) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(25);
  const [showCountdown, setShowCountdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate questions with improved error handling and performance
  const generateQuestions = useCallback(async (showRefreshLoader = false) => {
    // Reset state
    setError(null);
    
    if (showRefreshLoader) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    // Start countdown
    setShowCountdown(true);
    setCountdown(25);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const abortController = new AbortController();
    
    try {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        clearInterval(countdownInterval);
        setShowCountdown(false);
        console.log("Question generation timed out");
        toast.error("Question generation timed out. Using default questions.");
        setQuestions(DEFAULT_QUESTIONS);
        setLoading(false);
        setRefreshing(false);
      }, 25000);

      console.log(`Fetching questions for agent ${agentId}...`);
      const response = await fetch(`/api/agents/${agentId}/questions`, {
        signal: abortController.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      clearTimeout(timeoutId);
      clearInterval(countdownInterval);
      setShowCountdown(false);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Question generation failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to generate questions (${response.status}): ${errorText}`);
      }

      const data: QuestionResponse = await response.json();
      console.log('Question generation response:', data);

      if (data.success) {
        setQuestions(data.questions);
        if (data.fallback) {
          toast.info("Using fallback questions");
        }
        if (data.clarified) {
          toast.success("Smart questions generated");
        }
      } else {
        console.error('Question generation failed:', data.error);
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (_error) {
      console.error("Error generating questions:", _error);
      
      // Only show error if not already handled by timeout
      if (!(_error instanceof Error && _error.name === 'AbortError')) {
        const errorMessage = _error instanceof Error ? _error.message : "Failed to generate questions";
        setError(errorMessage);
        toast.error(errorMessage);
        setQuestions(DEFAULT_QUESTIONS);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setShowCountdown(false);
    }
  }, [agentId]);

  // Load questions on component mount
  useEffect(() => {
    if (agentId) {
      generateQuestions();
    }
  }, [agentId, generateQuestions]);

  // Loading state with skeleton UI
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Countdown above skeleton */}
        {showCountdown && (
          <div className="flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin" aria-hidden="true"></div>
            <span className="text-sm text-muted-foreground font-medium">
              Generating personalized questions... {countdown > 0 ? `${countdown}s remaining` : 'Almost done!'}
            </span>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Example Questions</h3>
          <Button
            variant="outline"
            size="sm"
            disabled={true}
            className="h-8 px-3 opacity-50"
          >
            <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
            <span>New Questions</span>
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-4 h-4 bg-muted rounded" aria-hidden="true"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" aria-hidden="true"></div>
                  <div className="h-3 bg-muted rounded w-1/2" aria-hidden="true"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && questions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Example Questions</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateQuestions(true)}
            disabled={refreshing}
            className="h-8 px-3"
          >
            <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
            <span>Try Again</span>
          </Button>
        </div>
        
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm text-destructive">Failed to generate questions</p>
              <p className="text-xs text-muted-foreground mt-1">Please try again or proceed with your own questions</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loaded questions
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Example Questions</h3>
        <div className="flex items-center gap-3">
          {showCountdown && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" aria-hidden="true"></div>
              <span className="min-w-[80px]">
                {countdown > 0 ? `${countdown}s left` : 'Almost done...'}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateQuestions(true)}
            disabled={refreshing}
            className="h-8 px-3"
            aria-label="Generate new example questions"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
            )}
            <span>{refreshing ? "Generating..." : "New Questions"}</span>
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {questions.map((question, index) => (
          <Card 
            key={`${question.substring(0, 20)}-${index}`}
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            onClick={() => onAskQuestion(question)}
            tabIndex={0}
            role="button"
            aria-label={`Ask question: ${question}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onAskQuestion(question);
              }
            }}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm text-muted-foreground leading-relaxed">{question}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Error display component
 */
function ErrorDisplay({ message }: { message: string }) {
  return (
    <Card className="border-destructive">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-destructive font-medium">Error</p>
            <p className="text-muted-foreground text-sm mt-1">{message}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main content component for the agent chat page
 */
function AgentChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedQuestion, setSelectedQuestion] = useState<string | undefined>();
  
  // Get agent details from URL parameters
  const agentId = searchParams.get('agentId');
  const agentName = searchParams.get('agentName');
  const agentDescription = searchParams.get('agentDescription');

  // Handle asking a question
  const handleAskQuestion = useCallback((question: string) => {
    setSelectedQuestion(question);
  }, []);

  // Handle going back
  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // Check if required parameters are missing
  if (!agentId || !agentName) {
    return (
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <ErrorDisplay message="Missing required agent parameters. Please provide agentId and agentName." />
      </div>
    );
  }

  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="mr-3 sm:mr-4 p-2 sm:p-3"
            size="sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" aria-hidden="true" />
            <span className="text-sm sm:text-base">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Bot className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
            <span>{agentName}</span>
          </h1>
        </div>
        
        {agentDescription && (
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="text-muted-foreground">{agentDescription}</p>
            </CardContent>
          </Card>
        )}

        <ExampleQuestions 
          agentId={agentId} 
          onAskQuestion={handleAskQuestion} 
        />

        <AgentChatInterface
          key={selectedQuestion}
          endpoint={`/api/chat/agent/${agentId}`}
          placeholder="Ask me anything..."
          emoji="🤖"
          initialQuestion={selectedQuestion}
        />
      </div>
    </div>
  );
}

/**
 * Main page component with Suspense for loading state
 */
export default function AgentChatPage() {
  return (
    <Suspense fallback={
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
          <span className="sr-only">Loading agent chat...</span>
        </div>
      </div>
    }>
      <AgentChatContent />
    </Suspense>
  );
}