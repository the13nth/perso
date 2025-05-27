"use client";

import { type Message, useChat, type UseChatOptions } from "ai/react";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type { UIMessage } from "@ai-sdk/ui-utils";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "./IntermediateStep";
import { Button } from "./ui/button";
import { ArrowDown, Loader2 } from "lucide-react";
import { Input } from "./ui/input";
import { cn } from "@/utils/cn";

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

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const disabled = props.loading && props.onStop == null;
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (props.loading) {
          props.onStop?.();
        } else {
          props.onSubmit(e);
        }
      }}
      className={cn("flex w-full flex-col", props.className)}
    >
      <div className="border border-input bg-secondary rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-4 mr-2 mb-2">
          <div className="flex gap-3">{props.children}</div>

          <div className="flex gap-2 self-end">
            {props.actions}
            <Button type="submit" className="self-end" disabled={disabled}>
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <Loader2 className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : (
                <span>Send</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={cn("grid grid-rows-[1fr,auto]", props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ChatLayout(props: { content: ReactNode; footer: ReactNode }) {
  return (
    <StickToBottom>
      <StickyToBottomContent
        className="absolute inset-0"
        contentClassName="py-8 px-2"
        content={props.content}
        footer={
          <div className="sticky bottom-8 px-2">
            <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
            {props.footer}
          </div>
        }
      />
    </StickToBottom>
  );
}

interface ChatWindowProps {
  endpoint: string;
  emptyStateComponent: React.ReactNode;
  placeholder?: string;
  titleText?: string;
  emoji?: string;
  sourcesForMessages?: Record<string, Source[]>;
}

export function ChatWindow({ 
  endpoint,
  emptyStateComponent,
  placeholder,
  titleText = "Chat",
  emoji,
  sourcesForMessages = {}
}: ChatWindowProps) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(false);
  const [intermediateStepsLoading, setIntermediateStepsLoading] = useState(false);
  const [localSourcesForMessages, setLocalSourcesForMessages] = useState<Record<string, Source[]>>(sourcesForMessages);

  const chatOptions: UseChatOptions = {
    api: endpoint,
    onResponse(response) {
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];

      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        setLocalSourcesForMessages({
          ...localSourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  };

  const chat = useChat(chatOptions);

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    if (!showIntermediateSteps) {
      chat.handleSubmit(e);
      return;
    }

    // Some extra work to show intermediate steps properly
    setIntermediateStepsLoading(true);

    chat.setInput("");
    const userMessage: Message = {
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user"
    };
    chat.setMessages([...chat.messages, userMessage]);

    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({
        messages: [...chat.messages, userMessage],
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
    const newMessages = [...chat.messages];

    // Add intermediate steps if any
    for (const message of responseMessages) {
      if (message.role === "system") {
        try {
          const parsedContent = JSON.parse(message.content);
          const systemMessage: UIMessage = {
            id: (newMessages.length + 1).toString(),
            role: "system",
            content: message.content,
            parts: [{
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: `tool_${newMessages.length}`,
                toolName: parsedContent.action,
                args: parsedContent.observation,
                result: parsedContent.observation
              }
            }]
          };
          newMessages.push(systemMessage);
          chat.setMessages([...newMessages]);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + Math.random() * 1000),
          );
        } catch {
          const systemMessage: UIMessage = {
            id: (newMessages.length + 1).toString(),
            role: "system",
            content: message.content,
            parts: [{
              type: 'text',
              text: message.content
            }]
          };
          newMessages.push(systemMessage);
          chat.setMessages([...newMessages]);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 + Math.random() * 1000),
          );
        }
      }
    }

    // Add final assistant message
    const finalMessage = responseMessages.find(m => m.role === "assistant" && !m.content.includes("tool_calls"));
    if (finalMessage) {
      chat.setMessages([...newMessages, finalMessage]);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {emoji && <span className="mr-2">{emoji}</span>}
          {titleText}
        </h1>
        <Button
          variant="outline"
          onClick={() => setShowIntermediateSteps(prev => !prev)}
        >
          {showIntermediateSteps ? 'Hide Steps' : 'Show Steps'}
        </Button>
      </div>

      {chat.messages.length > 0 ? (
        <div className="space-y-4">
          {chat.messages.map((message, i) => {
            if (message.role === "system") {
              return <IntermediateStep key={message.id} message={message} />;
            }
            return (
              <ChatMessageBubble
                key={message.id}
                message={message}
                sources={localSourcesForMessages[i.toString()]}
              />
            );
          })}
        </div>
      ) : (
        emptyStateComponent
      )}

      <form onSubmit={sendMessage} className="space-y-4">
        <div className="flex items-center space-x-2">
          <Input
            value={chat.input}
            placeholder={placeholder}
            onChange={chat.handleInputChange}
          />
          <Button type="submit" disabled={chat.isLoading || intermediateStepsLoading}>
            {chat.isLoading || intermediateStepsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Send"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
