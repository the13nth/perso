"use client";

import { type Message } from "ai";
import { useChat } from "ai/react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "./ui/button";
import { LoaderCircle, Bot, User, AlertCircle } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/utils/cn";
import { IntermediateStep } from "./IntermediateStep";

interface ChatCardProps {
  message: Message;
  aiEmoji?: string;
  sources?: any[];
}

function ChatCard({ message, aiEmoji, sources }: ChatCardProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  
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
                  <div className="font-medium break-words">{i + 1}. "{source.pageContent}"</div>
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
  const [sourcesForMessages, setSourcesForMessages] = useState<Record<string, any>>({});

  const chat = useChat({
    api: props.endpoint,
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
    streamMode: "text",
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });

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
    });
    chat.setMessages(messagesWithUserReply);

    const response = await fetch(props.endpoint, {
      method: "POST",
      body: JSON.stringify({
        messages: messagesWithUserReply,
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

    const responseMessages: Message[] = json.messages;
    const toolCallMessages = responseMessages.filter(
      (responseMessage: Message) => {
        return (
          (responseMessage.role === "assistant" && !!responseMessage.tool_calls?.length) ||
          responseMessage.role === "tool"
        );
      },
    );

    const intermediateStepMessages = [];
    for (let i = 0; i < toolCallMessages.length; i += 2) {
      const aiMessage = toolCallMessages[i];
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
  }

  // If no messages, show the initial info card
  if (chat.messages.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* <Card>
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              🤖 AI Agent with Tools
            </CardTitle>
            <CardDescription className="text-sm">
              This agent has access to multiple specialized tools and can help solve complex tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                🤝
                <span className="text-sm leading-relaxed">
                  This template showcases a{" "}
                  <a href="https://js.langchain.com/" target="_blank" className="text-primary hover:underline">
                    LangChain.js
                  </a>{" "}
                  agent and the Vercel{" "}
                  <a href="https://sdk.vercel.ai/docs" target="_blank" className="text-primary hover:underline">
                    AI SDK
                  </a>{" "}
                  in a{" "}
                  <a href="https://nextjs.org/" target="_blank" className="text-primary hover:underline">
                    Next.js
                  </a>{" "}
                  project.
                </span>
              </div>
              <div className="flex items-start gap-2">
                🛠️
                <span className="text-sm leading-relaxed">
                  The agent has memory and access to multiple tools including document analysis, weather information, database queries, image generation, code execution, web search, and calculations.
                </span>
              </div>
              <div className="hidden sm:flex items-start gap-2">
                💻
                <span className="text-sm leading-relaxed">
                  You can find the prompt and model logic for this use-case in{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">app/api/chat/agents/route.ts</code>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                🤖
                <span className="text-sm leading-relaxed">
                  The agent is an AI assistant that can use various tools to help solve complex tasks.
                </span>
              </div>
              <div className="hidden sm:flex items-start gap-2">
                🎨
                <span className="text-sm leading-relaxed">
                  The main frontend logic is found in{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">app/agents/page.tsx</code>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                👇
                <span className="text-sm leading-relaxed">
                  Try asking e.g. <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">What's the weather forecast for London this week?</code> or <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">Compare the weather in Tokyo and Sydney</code> below!
                </span>
              </div>
            </div>
          </CardContent>
        </Card> */}

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
      </div>
    );
  }

  // Show chat messages in cards
  return (
    <div className="space-y-4">
      {chat.messages.map((message, i) => {
        const sourceKey = (chat.messages.length - 1 - i).toString();
        return (
          <ChatCard
            key={message.id}
            message={message}
            aiEmoji={props.emoji}
            sources={sourcesForMessages[sourceKey]}
          />
        );
      })}
      
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
    </div>
  );
} 