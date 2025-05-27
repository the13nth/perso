"use client";

import { type Message } from "ai";
import { useChat } from "ai/react";
import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "./ui/button";
import { LoaderCircle, Bot, User, AlertCircle, Save } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/utils/cn";
import { IntermediateStep } from "./IntermediateStep";
import { CategorySelectionModal } from "./CategorySelectionModal";
import { v4 as uuidv4 } from 'uuid';
import { useUser } from "@clerk/nextjs";

interface ExtendedMessage extends Message {
  tool_calls?: { name: string; arguments: string }[];
}

interface Source {
  pageContent: string;
  metadata?: {
    loc?: {
      lines: {
        from: number;
        to: number;
      };
    };
  };
}

interface ChatCardProps {
  message: Message;
  aiEmoji?: string;
  sources?: Source[];
  sessionId?: string;
  onSaveResponse?: (query: string, response: string, sessionId: string) => void;
  previousUserMessage?: Message;
  isSaving?: boolean;
  isSaved?: boolean;
}

function ChatCard({ message, aiEmoji, sources, sessionId, onSaveResponse, previousUserMessage, isSaving, isSaved }: ChatCardProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const isAssistant = message.role === "assistant";
  
  if (isSystem) {
    return <IntermediateStep message={message} />;
  }

  return (
    <Card className={cn("mb-3 sm:mb-4", isUser ? "ml-auto max-w-[85%] sm:max-w-[80%]" : "mr-auto max-w-[95%] sm:max-w-[90%]")}>
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {isUser ? (
            <>
              <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-3 h-3" />
              </div>
              <span className="text-sm font-medium">You</span>
            </>
          ) : (
            <>
              <div className="w-6 h-6 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {aiEmoji || <Bot className="w-3 h-3" />}
              </div>
              <span className="text-sm font-medium">AI Assistant</span>
              {isAssistant && onSaveResponse && previousUserMessage && sessionId && (
                <div className="ml-auto flex items-center gap-2">
                  {isSaved ? (
                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Saved to Memory
                    </div>
                  ) : (
                    <Button
                      onClick={() => onSaveResponse(previousUserMessage.content, message.content, sessionId)}
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
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
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>
        
        {sources && sources.length > 0 && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Sources</span>
            </div>
            <div className="space-y-2">
              {sources.map((source, i) => (
                <div key={`source-${i}`} className="text-xs bg-muted/50 p-2 sm:p-2 rounded">
                  <div className="font-medium break-words">{i + 1}. &ldquo;{source.pageContent}&rdquo;</div>
                  {source.metadata?.loc?.lines && (
                    <div className="text-muted-foreground mt-1">
                      Lines {source.metadata.loc.lines.from} to {source.metadata.loc.lines.to}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

export function AgentChatInterface(props: {
  endpoint: string;
  placeholder?: string;
  emoji?: string;
  showIntermediateStepsToggle?: boolean;
  uploadButton?: React.ReactNode;
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

  const chat = useChat({
    api: props.endpoint,
    body: {
      sessionId: sessionId,
    },
    onResponse(response) {
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];

      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        setSourcesForMessages({
          ...sourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });

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
    } catch (error) {
      console.error('Error saving response:', error);
      toast.error("Failed to save response", {
        description: error instanceof Error ? error.message : "An unknown error occurred",
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

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    if (!showIntermediateSteps) {
      chat.handleSubmit(e);
      return;
    }

    // Handle intermediate steps
    setIntermediateStepsLoading(true);
    chat.setInput("");
    const messagesWithUserReply = chat.messages.concat({
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user",
      parts: [{
        type: 'text',
        text: chat.input
      }]
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
        parts: [{
          type: 'tool-invocation' as const,
          toolInvocation: {
            state: 'result' as const,
            toolCallId: `tool_${i}`,
            toolName: aiMessage.tool_calls?.[0].name ?? '',
            args: aiMessage.tool_calls?.[0].arguments ?? '',
            result: toolMessage.content
          }
        }]
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
  }

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
          placeholder={props.placeholder ?? "I&apos;m an AI assistant with access to many tools. How can I help you today?"}
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
      
      {chat.messages.map((message, i) => {
        const sourceKey = (chat.messages.length - 1 - i).toString();
        const previousUserMessage = chat.messages[i - 1];
        const messageKey = previousUserMessage && message.role === "assistant" 
          ? `${previousUserMessage.content}-${message.content}` 
          : `${message.id}`;
        
        return (
          <ChatCard
            key={message.id}
            message={message}
            aiEmoji={props.emoji}
            sources={sourcesForMessages[sourceKey]}
            sessionId={sessionId}
            onSaveResponse={(query, response, sessionId) => {
              initiateSaveResponse(query, response, sessionId);
            }}
            previousUserMessage={previousUserMessage as Message}
            isSaving={savingStates[messageKey] || false}
            isSaved={savedResponses.has(messageKey)}
          />
        );
      })}
      
      <ChatInput
        value={chat.input}
        onChange={chat.handleInputChange}
        onSubmit={sendMessage}
        loading={chat.isLoading || intermediateStepsLoading}
        placeholder={props.placeholder ?? "I&apos;m an AI assistant with access to many tools. How can I help you today?"}
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