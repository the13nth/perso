import React from 'react';
import type { Message } from 'ai';
import { MessageContent, FormattedSection } from './MessageContent';
import { Avatar } from '../ui/avatar';

interface MessageType extends Message {
  formattedContent?: FormattedSection[];
}

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const formattedContent = message.formattedContent || [];

  return (
    <div className={`flex items-start gap-4 p-4 ${isUser ? 'bg-gray-900' : 'bg-gray-950'}`}>
      <Avatar role={message.role} />
      <div className="flex-1 overflow-hidden">
        {formattedContent.length > 0 ? (
          <MessageContent content={formattedContent} />
        ) : (
          <div className="text-white whitespace-pre-wrap">{message.content}</div>
        )}
      </div>
    </div>
  );
} 