import { type Message } from 'ai';
import { getAgentConfig } from './config';

export interface AgentResponse {
  messages: Message[];
  error?: string;
}

export async function getAgentContext(_agentId: string, _query: string) {
  // TODO: Implement context retrieval from vector store
  return [];
}

export async function handleAgentChat(
  agentId: string,
  messages: Message[],
  _showIntermediateSteps: boolean = false
): Promise<AgentResponse> {
  try {
    const config = await getAgentConfig(agentId);
    
    // For now, just echo back the last message
    // TODO: Implement actual agent chat handling
    const lastMessage = messages[messages.length - 1];
    
    return {
      messages: [
        ...messages,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: `[${config.name}] Received: ${lastMessage.content}`
        }
      ]
    };
  } catch (error) {
    return {
      messages: [],
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
} 