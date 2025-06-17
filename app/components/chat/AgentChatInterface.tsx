'use client';

import { useState } from 'react';
import { AgentContextDisplay } from './AgentContextDisplay';
import { ProcessedContext } from '@/lib/services/context/types';

interface Message {
  role: 'user' | 'agent';
  content: string;
  context?: ProcessedContext;
}

interface AgentChatInterfaceProps {
  agentId: string;
  userId: string;
  initialContext?: ProcessedContext;
}

export function AgentChatInterface({
  agentId,
  userId,
  initialContext
}: AgentChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentContext, setCurrentContext] = useState<ProcessedContext | undefined>(initialContext);
  
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    setIsLoading(true);
    
    // Add user message
    const userMessage: Message = {
      role: 'user',
      content: inputValue
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    
    try {
      // Send message to agent
      const response = await fetch(`/api/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          message: inputValue,
          contextOptions: {
            includeUserHistory: true
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }
      
      // Add agent response with context
      const agentMessage: Message = {
        role: 'agent',
        content: data.response.message,
        context: data.response.context
      };
      
      setMessages(prev => [...prev, agentMessage]);
      setCurrentContext(data.response.context);
      
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: 'agent',
          content: 'Sorry, I encountered an error processing your message.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex h-full">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100'
                }`}
              >
                <div className="text-sm">{message.content}</div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Input Area */}
        <div className="border-t p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className="flex-1 border rounded-lg px-4 py-2"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Context Sidebar */}
      <div className="w-80 border-l">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Current Context</h2>
          {currentContext && (
            <AgentContextDisplay
              context={currentContext}
              className="bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
} 