"use client";

import { useState, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgentChatInterface } from "@/components/AgentChatInterface";
import { Bot, ArrowLeft, MessageSquare } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";

// Example questions component
function ExampleQuestions({ onAskQuestion }: { onAskQuestion: (question: string) => void }) {
  const questions = [
    "What is your main purpose?",
    "What specific tasks can you help with?",
    "Can you show me an example of your capabilities?"
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {questions.map((question, index) => (
        <Card 
          key={index} 
          className="cursor-pointer hover:shadow-md transition-shadow duration-200"
          onClick={() => onAskQuestion(question)}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{question}</span>
          </CardContent>
        </Card>
      ))}
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

        <ExampleQuestions onAskQuestion={handleAskQuestion} />

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

// Wrap the content in Suspense in the main page component
export default function AgentChatPage() {
  return (
    <Suspense fallback={
      <div className="container py-4 px-4 sm:py-6 space-y-6 sm:space-y-8 max-w-7xl">
        <Card>
          <CardContent className="p-8 flex justify-center items-center">
            <div className="animate-pulse">Loading...</div>
          </CardContent>
        </Card>
      </div>
    }>
      <AgentChatContent />
    </Suspense>
  );
} 