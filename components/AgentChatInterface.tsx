"use client";

import { useChat, Message } from "ai/react";
import React, { useState, useCallback, useEffect } from "react";
import type { FormEvent } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { LoaderCircle, Bot, User, Save } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { IntermediateStep } from "./IntermediateStep";
import { CategorySelectionModal } from "./CategorySelectionModal";
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { format } from "date-fns";
import { LangGraphUI, ProcessStep } from './LangGraphUI';
import { CategoryBubble } from '@/app/components/chat/CategoryBubble';
import { cn } from "@/utils/cn";

interface Source {
  contentPreview: string;
  source: string;
  score: number;
  category: string;
}

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ExtendedMessage extends Omit<Message, 'tool_calls'> {
  tool_calls?: ToolCall[];
  categoryContexts?: Array<{
    category: string;
    count: number;
    relevantCount: number;
  }>;
}

interface ChatCardProps {
  message: ExtendedMessage;
  aiEmoji?: string;
  sources?: Source[];
  sessionId?: string;
  onSaveResponse?: (query: string, response: string, sessionId: string) => void;
  previousUserMessage?: Message;
  isSaving?: boolean;
  isSaved?: boolean;
}

const ChatCard = React.memo(({ message, aiEmoji, sources, sessionId, onSaveResponse, previousUserMessage, isSaving, isSaved }: ChatCardProps) => {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";
  
  if (isSystem) {
    return <IntermediateStep message={message} />;
  }

  // Helper function to clean and parse nested responses
  const cleanAndParseResponse = (content: string): string => {
    try {
      // First try to parse as JSON
      const parsed = JSON.parse(content);
      
      // Case 1: Response with success and response fields
      if (parsed.success && parsed.response) {
        return parsed.response;
      }

      // Case 2: Response with formattedContent array
      if (parsed.formattedContent && Array.isArray(parsed.formattedContent)) {
        return parsed.formattedContent
          .map((item: { type: string; content: string }) => item.content)
          .join('\n');
      }

      // Case 3: Direct text content
      if (typeof parsed === 'string') {
        return parsed;
      }

      // Case 4: Nested content field
      if (parsed.content) {
        return typeof parsed.content === 'string' ? parsed.content : JSON.stringify(parsed.content);
      }

      // If no recognized format, return the stringified JSON but formatted nicely
      return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, return as is
      return content;
    }
  };

  // Process the message content
  const processedContent = isAssistant ? cleanAndParseResponse(message.content) : message.content;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="w-full"
    >
      <Card className={cn(
        "mb-3 sm:mb-4 transition-shadow duration-200 hover:shadow-md",
        isUser ? "ml-auto max-w-[85%] sm:max-w-[80%] bg-primary/5" : "mr-auto max-w-[95%] sm:max-w-[90%]"
      )}>
        <CardHeader className="pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isUser ? (
              <>
                <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3" />
                </div>
                <span className="text-sm font-medium">You</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(), 'HH:mm')}
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {aiEmoji ? (
                    <span className="text-sm">{aiEmoji}</span>
                  ) : (
                    <Bot className="w-3 h-3" />
                  )}
                </div>
                <span className="text-sm font-medium">AI Assistant</span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(), 'HH:mm')}
                </span>
                {isAssistant && onSaveResponse && previousUserMessage && sessionId && (
                  <div className="ml-auto flex items-center gap-2">
                    {isSaved ? (
                      <motion.div 
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        Saved to Memory
                      </motion.div>
                    ) : (
                      <Button
                        onClick={() => onSaveResponse(previousUserMessage.content, processedContent, sessionId)}
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs hover:bg-primary/5 transition-colors"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <LoaderCircle className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Save className="w-3 h-3 mr-1" />
                            Save Response
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className={cn(
            "prose prose-sm dark:prose-invert max-w-none",
            isUser ? "text-primary" : ""
          )}>
            {isUser ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {processedContent}
              </div>
            ) : (
              <ReactMarkdown
                components={{
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold mt-4 mb-2 text-primary dark:text-primary-foreground">{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-2 space-y-2">{children}</ul>
                  ),
                  li: ({ children }) => (
                    <motion.li 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start"
                    >
                      <span className="mr-2 text-primary dark:text-primary-foreground">•</span>
                      {children}
                    </motion.li>
                  )
                }}
              >
                {processedContent}
              </ReactMarkdown>
            )}

            {/* Add Sources Display */}
            {!isUser && sources && sources.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-gray-800/40 rounded-lg border border-gray-700"
              >
                <div className="px-4 py-2 border-b border-gray-700">
                  <h3 className="text-sm font-medium text-gray-200">Sources & References</h3>
                </div>
                <div className="p-4 space-y-3">
                  {sources.map((source, index) => (
                    <div key={index} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-400">{source.source}</span>
                        <span className="text-xs text-gray-400">
                          {Math.round(source.score * 100)}% relevance
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{source.contentPreview}</p>
                      <div className="text-xs text-gray-500">Category: {source.category}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Show category bubbles for AI messages */}
            {isAssistant && message.categoryContexts && message.categoryContexts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {message.categoryContexts.map((ctx) => (
                  <CategoryBubble
                    key={ctx.category}
                    category={ctx.category}
                    count={ctx.count}
                    relevantCount={ctx.relevantCount}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
});

ChatCard.displayName = 'ChatCard';

function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  showIntermediateStepsToggle?: boolean;
  showIntermediateSteps?: boolean;
  onToggleIntermediateSteps?: (checked: boolean) => void;
  uploadButton?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <form onSubmit={props.onSubmit} className="space-y-3">
          {props.uploadButton}
          <div className="flex gap-2">
            <input
              value={props.value}
              placeholder={props.placeholder}
              onChange={props.onChange}
              className="flex-1 border border-input bg-background px-3 py-2.5 sm:py-2 rounded-md text-sm outline-none focus:ring-2 focus:ring-ring min-h-[44px] sm:min-h-[40px]"
              disabled={props.loading}
            />
            <Button type="submit" disabled={props.loading} className="h-11 sm:h-10 px-4 sm:px-3 text-sm">
              {props.loading ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                "Send"
              )}
            </Button>
          </div>
          
          {props.showIntermediateStepsToggle && (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="show_intermediate_steps"
                checked={props.showIntermediateSteps}
                disabled={props.loading}
                onCheckedChange={props.onToggleIntermediateSteps}
                className="h-4 w-4"
              />
              <label htmlFor="show_intermediate_steps" className="text-sm text-muted-foreground select-none">
                Show intermediate steps
              </label>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// Wrap the chat messages list in LayoutGroup
function ChatMessages({ 
  messages, 
  aiEmoji, 
  sourcesForMessages, 
  sessionId,
  onSaveResponse, 
  savingStates, 
  savedResponses,
  processingSteps
}: {
  messages: ExtendedMessage[];
  aiEmoji?: string;
  sourcesForMessages: Record<string, Source[]>;
  sessionId: string;
  onSaveResponse: (query: string, response: string, sessionId: string) => void;
  savingStates: Record<string, boolean>;
  savedResponses: Set<string>;
  processingSteps: ProcessStep[];
}) {
  return (
    <div className="flex-1 space-y-6 overflow-y-auto">
      <LayoutGroup>
        <AnimatePresence initial={false}>
          {messages.map((message, i) => (
            <ChatCard
              key={message.id}
              message={message}
              aiEmoji={aiEmoji}
              sources={sourcesForMessages[message.id]}
              sessionId={sessionId}
              onSaveResponse={onSaveResponse}
              previousUserMessage={messages[i - 1]?.role === 'user' ? messages[i - 1] : undefined}
              isSaving={savingStates[message.id]}
              isSaved={savedResponses.has(message.id)}
            />
          ))}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

export function AgentChatInterface(props: {
  endpoint: string;
  placeholder?: string;
  emoji?: string;
  showIntermediateStepsToggle?: boolean;
  uploadButton?: React.ReactNode;
  initialQuestion?: string;
}) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(
    !!props.showIntermediateStepsToggle,
  );
  const [intermediateStepsLoading, setIntermediateStepsLoading] = useState(false);
  const [sourcesForMessages, setSourcesForMessages] = useState<Record<string, Source[]>>({});
  const [sessionId, setSessionId] = useState(uuidv4());
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  const [savedResponses, setSavedResponses] = useState<Set<string>>(new Set());
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<{
    query: string;
    response: string;
    sessionId: string;
  } | null>(null);
  const { user } = useUser();
  const [processingSteps, setProcessingSteps] = useState<ProcessStep[]>([]);

  const chat = useChat({
    api: props.endpoint,
    onFinish: (message) => {
      try {
        // Parse the message content as JSON
        const data = JSON.parse(message.content);
        if (data.closestMatches) {
          // Store sources for this message
          setSourcesForMessages(prev => ({
            ...prev,
            [message.id]: data.closestMatches
          }));
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    }
  }) as { messages: ExtendedMessage[] } & Omit<ReturnType<typeof useChat>, 'messages'>;

  const sendMessage = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    // Initialize processing steps
    const initializeProcessingSteps = () => {
      const steps: ProcessStep[] = [
        {
          id: uuidv4(),
          label: 'Query Analysis',
          type: 'input',
          status: 'running',
          details: 'Analyzing user query and context requirements',
          timestamp: Date.now()
        },
        {
          id: uuidv4(),
          label: 'Context Retrieval',
          type: 'process',
          status: 'pending',
          details: 'Searching for relevant information in the knowledge base',
          timestamp: Date.now()
        },
        {
          id: uuidv4(),
          label: 'Response Generation',
          type: 'process',
          status: 'pending',
          details: 'Generating contextual response using AI',
          timestamp: Date.now()
        },
        {
          id: uuidv4(),
          label: 'Final Response',
          type: 'output',
          status: 'pending',
          details: 'Formatting and delivering the response',
          timestamp: Date.now()
        }
      ];
      setProcessingSteps(steps);
      return steps;
    };

    const steps = initializeProcessingSteps();

    if (!showIntermediateSteps) {
      try {
        // Update Query Analysis step
        updateProcessingStep(steps[0].id, { 
          status: 'completed',
          details: `Analyzed query: "${chat.input}"`,
          timestamp: Date.now()
        });

        // Update Context Retrieval step
        updateProcessingStep(steps[1].id, { 
          status: 'running',
          timestamp: Date.now()
        });

        chat.handleSubmit(e);

        // Simulate steps completion (you can replace these with actual progress from the backend)
        setTimeout(() => {
          updateProcessingStep(steps[1].id, { 
            status: 'completed',
            details: 'Retrieved relevant context from knowledge base',
            timestamp: Date.now()
          });
          updateProcessingStep(steps[2].id, { 
            status: 'running',
            timestamp: Date.now()
          });
        }, 2000);

        setTimeout(() => {
          updateProcessingStep(steps[2].id, { 
            status: 'completed',
            details: 'Generated response using AI model',
            timestamp: Date.now()
          });
          updateProcessingStep(steps[3].id, { 
            status: 'running',
            timestamp: Date.now()
          });
        }, 4000);

        setTimeout(() => {
          updateProcessingStep(steps[3].id, { 
            status: 'completed',
            details: 'Response formatted and ready',
            timestamp: Date.now()
          });
        }, 5000);

      } catch (_error: unknown) {
        // Handle error state in steps
        console.error('Processing error:', _error);
        setProcessingSteps(steps => 
          steps.map(step => ({
            ...step,
            status: step.status === 'running' ? 'error' : step.status,
            details: step.status === 'running' ? 'An error occurred during processing' : step.details
          }))
        );
      }
      return;
    }

    // Handle intermediate steps
    setIntermediateStepsLoading(true);
    chat.setInput("");
    const messagesWithUserReply = chat.messages.concat({
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user",
    });
    chat.setMessages(messagesWithUserReply);

    const response = await fetch(props.endpoint, {
      method: "POST",
      body: JSON.stringify({
        messages: messagesWithUserReply,
        sessionId: sessionId,
        show_intermediate_steps: true,
      }),
    });
    
    const json = await response.json();
    setIntermediateStepsLoading(false);

    if (!response.ok) {
      toast.error(`Error while processing your request`, {
        description: json.error,
      });
      return;
    }

    const responseMessages: ExtendedMessage[] = json.messages;
    const toolCallMessages = responseMessages.filter(
      (responseMessage: ExtendedMessage) => {
        return responseMessage.role === "assistant" && !!responseMessage.tool_calls?.length;
      },
    );

    const intermediateStepMessages = [];
    for (let i = 0; i < toolCallMessages.length; i += 2) {
      const aiMessage = toolCallMessages[i] as ExtendedMessage;
      const toolMessage = toolCallMessages[i + 1];
      intermediateStepMessages.push({
        id: (messagesWithUserReply.length + i / 2).toString(),
        role: "system" as const,
        content: JSON.stringify({
          action: aiMessage.tool_calls?.[0],
          observation: toolMessage.content,
        }),
      });
    }
    
    const newMessages = messagesWithUserReply;
    for (const message of intermediateStepMessages) {
      newMessages.push(message);
      chat.setMessages([...newMessages]);
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
    }

    chat.setMessages([
      ...newMessages,
      {
        id: newMessages.length.toString(),
        content: responseMessages[responseMessages.length - 1].content,
        role: "assistant",
      },
    ]);
  }, [chat, intermediateStepsLoading, showIntermediateSteps, props.endpoint, sessionId, setProcessingSteps]);

  // Effect to handle initial question
  useEffect(() => {
    if (props.initialQuestion && chat.messages.length === 0) {
      chat.setInput(props.initialQuestion);
      const fakeEvent = new Event('submit') as unknown as FormEvent<HTMLFormElement>;
      sendMessage(fakeEvent);
    }
  }, [props.initialQuestion, chat, sendMessage]);

  useEffect(() => {
    setSessionId(uuidv4());
  }, []);

  // Function to trigger save response with category selection
  const initiateSaveResponse = (query: string, response: string, sessionId: string) => {
    if (!user?.id) {
      toast.error("You must be logged in to save responses");
      return;
    }

    setPendingSaveData({ query, response, sessionId });
    setShowCategoryModal(true);
  };

  // Function to save response to Pinecone with selected categories
  const saveResponseWithCategories = async (categories: string[]) => {
    if (!pendingSaveData || !user?.id) {
      toast.error("Missing data for saving response");
      return;
    }

    const { query, response, sessionId } = pendingSaveData;
    const messageKey = `${query}-${response}`;
    setSavingStates(prev => ({ ...prev, [messageKey]: true }));

    try {
      const saveResponse = await fetch('/api/retrieval/save-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          response,
          sessionId,
          userId: user.id,
          categories, // Include selected categories
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.message || 'Failed to save response');
      }

      await saveResponse.json();
      
      // Mark this response as saved
      setSavedResponses(prev => new Set([...Array.from(prev), messageKey]));
      
      toast.success("Response saved successfully!", {
        description: `Saved to ${categories.length} ${categories.length === 1 ? 'category' : 'categories'}: ${categories.join(', ')}`,
        duration: 4000,
      });
    } catch (_error) {
      console.error('Error saving response:', _error);
      toast.error("Failed to save response", {
        description: _error instanceof Error ? _error.message : "An unknown error occurred",
        duration: 5000,
      });
    } finally {
      setSavingStates(prev => ({ ...prev, [messageKey]: false }));
      setShowCategoryModal(false);
      setPendingSaveData(null);
    }
  };

  const handleModalClose = () => {
    setShowCategoryModal(false);
    setPendingSaveData(null);
  };

  // Function to update processing steps
  const updateProcessingStep = (stepId: string, update: Partial<ProcessStep>) => {
    setProcessingSteps(steps => 
      steps.map(step => 
        step.id === stepId ? { ...step, ...update } : step
      )
    );
  };

  // If no messages, show the initial info card
  if (chat.messages.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Session Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Session Active</span>
              <span className="text-xs text-muted-foreground ml-auto">ID: {sessionId.slice(0, 8)}...</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              Your conversations in this session can be saved to memory and will be available for future reference. 
              Click &quot;Save Response&quot; on AI messages to add them to your personal knowledge base.
            </p>
          </CardContent>
        </Card>

        <ChatInput
          value={chat.input}
          onChange={chat.handleInputChange}
          onSubmit={sendMessage}
          loading={chat.isLoading || intermediateStepsLoading}
          placeholder={props.placeholder ?? "I'm an AI assistant with access to many tools. How can I help you today?"}
          showIntermediateStepsToggle={props.showIntermediateStepsToggle}
          showIntermediateSteps={showIntermediateSteps}
          onToggleIntermediateSteps={setShowIntermediateSteps}
          uploadButton={props.uploadButton}
        />

        {/* Category Selection Modal */}
        <CategorySelectionModal
          isOpen={showCategoryModal}
          onClose={handleModalClose}
          onSave={saveResponseWithCategories}
          isLoading={pendingSaveData ? savingStates[`${pendingSaveData.query}-${pendingSaveData.response}`] || false : false}
        />
      </div>
    );
  }

  // Show chat messages in cards
  return (
    <div className="space-y-4">
      {/* Session Info Header */}
      <Card className="border-dashed">
        <CardContent className="py-2 px-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span>Session {sessionId.slice(0, 8)}...</span>
            </div>
            <span>{chat.messages.filter(m => m.role === 'assistant').length} AI responses</span>
          </div>
        </CardContent>
      </Card>
      
      <ChatMessages
        messages={chat.messages}
        aiEmoji={props.emoji}
        sourcesForMessages={sourcesForMessages}
        sessionId={sessionId}
        onSaveResponse={initiateSaveResponse}
        savingStates={savingStates}
        savedResponses={savedResponses}
        processingSteps={processingSteps}
      />
      
      <ChatInput
        value={chat.input}
        onChange={chat.handleInputChange}
        onSubmit={sendMessage}
        loading={chat.isLoading || intermediateStepsLoading}
        placeholder={props.placeholder ?? "I'm an AI assistant with access to many tools. How can I help you today?"}
        showIntermediateStepsToggle={props.showIntermediateStepsToggle}
        showIntermediateSteps={showIntermediateSteps}
        onToggleIntermediateSteps={setShowIntermediateSteps}
        uploadButton={props.uploadButton}
      />

      {/* Category Selection Modal */}
      <CategorySelectionModal
        isOpen={showCategoryModal}
        onClose={handleModalClose}
        onSave={saveResponseWithCategories}
        isLoading={pendingSaveData ? savingStates[`${pendingSaveData.query}-${pendingSaveData.response}`] || false : false}
      />
    </div>
  );
} 