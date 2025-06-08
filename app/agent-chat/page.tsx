"use client";

import { useState, Suspense, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentChatInterface } from "@/components/AgentChatInterface";
import { Bot, ArrowLeft, MessageSquare, RefreshCw, Loader2 } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

// Dynamic questions component with LLM generation
function ExampleQuestions({ 
  agentId, 
  onAskQuestion 
}: { 
  agentId: string;
  onAskQuestion: (question: string) => void;
}) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(25);
  const [showCountdown, setShowCountdown] = useState(false);

  const generateQuestions = async (showRefreshLoader = false) => {
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

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        clearInterval(countdownInterval);
        setShowCountdown(false);
        toast.error("Question generation timed out");
        setQuestions([
          "What is your main purpose?",
          "What specific tasks can you help with?",
          "Can you show me an example of your capabilities?"
        ]);
        setLoading(false);
        setRefreshing(false);
      }, 25000);

      const response = await fetch(`/api/agents/${agentId}/questions`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      clearInterval(countdownInterval);
      setShowCountdown(false);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setQuestions(data.questions);
        if (data.fallback) {
          toast.info("Using fallback questions");
        }
        if (data.clarified) {
          toast.success("Smart questions generated");
        }
      } else {
        throw new Error(data.error || "Failed to generate questions");
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      
      // Only show error if not already handled by timeout
      if (!(error instanceof Error && error.name === 'AbortError')) {
        toast.error("Failed to generate questions");
        setQuestions([
          "What is your main purpose?",
          "What specific tasks can you help with?",
          "Can you show me an example of your capabilities?"
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setShowCountdown(false);
    }
  };

  useEffect(() => {
    if (agentId) {
      generateQuestions();
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Countdown above skeleton */}
        {showCountdown && (
          <div className="flex items-center justify-center gap-3 p-4 bg-muted/30 rounded-lg border">
            <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
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
            <RefreshCw className="h-3 w-3 mr-1" />
            New Questions
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-4 h-4 bg-muted rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Example Questions</h3>
        <div className="flex items-center gap-3">
          {showCountdown && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-6 h-6 rounded-full border-2 border-primary/20 border-t-primary animate-spin"></div>
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
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {refreshing ? "Generating..." : "New Questions"}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {questions.map((question, index) => (
          <Card 
            key={`${question}-${index}`}
            className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02]"
            onClick={() => onAskQuestion(question)}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground leading-relaxed">{question}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Create a client component for the main content
function AgentChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedQuestion, setSelectedQuestion] = useState<string | undefined>();
  
  const agentId = searchParams.get('agentId');
  const agentName = searchParams.get('agentName');
  const agentDescription = searchParams.get('agentDescription');

  const handleAskQuestion = (question: string) => {
    setSelectedQuestion(question);
  };

  if (!agentId || !agentName || !agentDescription) {
    return (
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Missing required agent parameters. Please provide agentId, agentName, and agentDescription.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="mr-3 sm:mr-4 p-2 sm:p-3"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="text-sm sm:text-base">Back</span>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
            {agentName}
          </h1>
        </div>
        
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-muted-foreground">{agentDescription}</p>
          </CardContent>
        </Card>

        {agentId && (
          <ExampleQuestions 
            agentId={agentId} 
            onAskQuestion={handleAskQuestion} 
          />
        )}

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

export default function AgentChatPage() {
  return (
    <Suspense fallback={
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    }>
      <AgentChatContent />
    </Suspense>
  );
} 