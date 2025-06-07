"use client";

import { useChat } from "ai/react";
import React, { useState, useCallback } from "react";
import type { FormEvent } from "react";
import { Button } from "./ui/button";
import { LoaderCircle } from "lucide-react";
import { LangGraphUI } from './LangGraphUI';

interface ProcessingStep {
  id: string;
  label: string;
  type: 'input' | 'process' | 'output';
  status: 'pending' | 'running' | 'completed' | 'error';
  details: string;
  timestamp: number;
  metadata?: {
    agentId?: string;
    capability?: string;
    confidence?: number;
    processingTime?: number;
  };
}

// Update the initial steps to match the new format
const initialSteps: ProcessingStep[] = [
  {
    id: 'query',
    label: 'Query Analysis',
    type: 'input',
    status: 'pending',
    details: 'Analyzing user query',
    timestamp: Date.now(),
    metadata: {
      capability: 'query_analysis'
    }
  },
  {
    id: 'context',
    label: 'Context Retrieval',
    type: 'process',
    status: 'pending',
    details: 'Retrieving relevant context',
    timestamp: Date.now(),
    metadata: {
      capability: 'context_retrieval'
    }
  },
  {
    id: 'capability',
    label: 'Capability Selection',
    type: 'process',
    status: 'pending',
    details: 'Selecting appropriate capabilities',
    timestamp: Date.now(),
    metadata: {
      capability: 'capability_selection'
    }
  },
  {
    id: 'execution',
    label: 'Task Execution',
    type: 'process',
    status: 'pending',
    details: 'Executing task with selected capabilities',
    timestamp: Date.now(),
    metadata: {
      capability: 'task_execution'
    }
  },
  {
    id: 'response',
    label: 'Response Generation',
    type: 'output',
    status: 'pending',
    details: 'Generating final response',
    timestamp: Date.now(),
    metadata: {
      capability: 'response_generation'
    }
  }
];

export function AgentChatInterface(props: {
  endpoint: string;
  placeholder?: string;
}) {
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>(initialSteps);

  const updateProcessingStep = (stepId: string, updates: Partial<ProcessingStep>) => {
    setProcessingSteps(steps => 
      steps.map(step => 
        step.id === stepId 
          ? { ...step, ...updates }
          : step
      )
    );
  };

  const chat = useChat({
    api: props.endpoint,
  });

  const sendMessage = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      // Update Query Analysis step
      updateProcessingStep('query', { 
        status: 'completed',
        details: `Analyzed query: "${chat.input}"`,
        timestamp: Date.now()
      });

      // Update Context Analysis step
      updateProcessingStep('context', { 
        status: 'running',
        details: 'Analyzing contexts from parent agents',
        timestamp: Date.now()
      });

      chat.handleSubmit(e);

      // Simulate steps completion
      setTimeout(() => {
        updateProcessingStep('context', { 
          status: 'completed',
          details: 'Contexts analyzed and merged',
          timestamp: Date.now()
        });
        updateProcessingStep('capability', { 
          status: 'running',
          details: 'Merging capabilities from parent agents',
          timestamp: Date.now()
        });
      }, 2000);

      setTimeout(() => {
        updateProcessingStep('capability', { 
          status: 'completed',
          details: 'Agent capabilities merged successfully',
          timestamp: Date.now()
        });
        updateProcessingStep('execution', { 
          status: 'running',
          details: 'Executing task with selected capabilities',
          timestamp: Date.now()
        });
      }, 4000);

      setTimeout(() => {
        updateProcessingStep('execution', { 
          status: 'completed',
          details: 'Task executed successfully',
          timestamp: Date.now()
        });
        updateProcessingStep('response', { 
          status: 'running',
          details: 'Generating response using combined capabilities',
          timestamp: Date.now()
        });
      }, 5000);

    } catch (error: unknown) {
      // Handle error state in steps
      console.error('Processing error:', error);
      setProcessingSteps(steps => 
        steps.map(step => ({
          ...step,
          status: step.status === 'running' ? 'error' : step.status,
          details: step.status === 'running' ? 'An error occurred during processing' : step.details
        }))
      );
    }
  }, [chat]);

  return (
    <div className="flex flex-col space-y-4">
      {/* Show processing steps */}
      <LangGraphUI steps={processingSteps} />

      {/* Chat input */}
      <div className="relative">
        <form onSubmit={sendMessage} className="flex space-x-2">
          <input
            className="flex-1 p-2 border rounded"
            value={chat.input}
            onChange={chat.handleInputChange}
            placeholder={props.placeholder || "Ask me anything..."}
          />
          <Button type="submit" disabled={chat.isLoading}>
            {chat.isLoading ? (
              <LoaderCircle className="w-4 h-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
} 