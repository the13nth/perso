import { GoogleGenAI } from '@google/genai';
import { Document } from 'langchain/document';
import { getAgentConfig, getAgentContext, AgentMetadata } from '../pinecone';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize the Google Gen AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  apiVersion: 'v1'
});

export interface Message {
  role: string;
  content: string;
}

export interface RAGResponse {
  success: boolean;
  response: string;
  agentId: string;
  contextUsed: number;
  relevanceScores: Array<{
    source?: string;
    score?: number;
  }>;
}

export class AgentRAGService {
  private formatContext(contextDocs: Document[]): string {
    if (contextDocs.length === 0) {
      return "No relevant context found. Please provide more information or rephrase your query.";
    }

    return contextDocs
      .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .map((doc, index) => {
        const score = doc.metadata?.score ? Math.round(doc.metadata.score * 100) : 0;
        return `[Context ${index + 1}] (Relevance: ${score}%)
Source: ${doc.metadata?.source || 'Unknown'}
${doc.pageContent}
---`;
      }).join('\n\n');
  }

  private createSystemPrompt(agentConfig: AgentMetadata, formattedContext: string): string {
    return `You are ${agentConfig.name}, an AI agent with expertise in ${agentConfig.category}.

ROLE AND EXPERTISE:
- You are a specialized agent for: ${agentConfig.description}
- Your core purpose is: ${agentConfig.useCases}
- You have access to specific context documents that inform your knowledge

RESPONSE GUIDELINES:
1. Always ground your responses in the provided context
2. If the context doesn't contain relevant information, acknowledge this and explain what you can/cannot answer
3. Be precise and specific, citing relevant parts of the context when appropriate
4. Maintain a professional but conversational tone
5. Focus on providing accurate, context-based information rather than general knowledge

CONTEXT DOCUMENTS:
${formattedContext}

Remember: Only provide information that you can support with the given context. If asked about something outside your context, politely explain that it's beyond your current knowledge scope.`;
  }

  private formatConversationHistory(messages: Message[], systemPrompt: string) {
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    return [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'assistant', parts: [{ text: 'I understand my role and context. I will provide responses based on my specialized knowledge.' }] },
      ...conversationHistory
    ];
  }

  public async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    try {
      console.log('Generating response for agent:', agentId);
      console.log('Message count:', messages.length);

      // Get the last user message
      const lastUserMessage = messages[messages.length - 1];
      if (!lastUserMessage || lastUserMessage.role !== "user") {
        throw new Error("Last message must be from user");
      }

      console.log('User query:', lastUserMessage.content);

      // Get agent configuration and context using the user's query
      const [agentConfig, contextDocs] = await Promise.all([
        getAgentConfig(agentId),
        getAgentContext(agentId, lastUserMessage.content)
      ]);

      console.log('Retrieved context documents:', contextDocs.length);
      console.log('Agent config:', {
        name: agentConfig.name,
        category: agentConfig.category,
        description: agentConfig.description
      });

      // Format context and create system prompt
      const formattedContext = this.formatContext(contextDocs);
      const systemPrompt = this.createSystemPrompt(agentConfig, formattedContext);

      // Format conversation history
      const fullConversation = this.formatConversationHistory(messages, systemPrompt);

      // Generate response using the model
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: fullConversation,
        config: {
          maxOutputTokens: 2048,
          temperature: 0.7
        }
      });

      const result: RAGResponse = {
        success: true,
        response: contextDocs.length === 0 
          ? "I need you to provide me with your running activities so I can analyze them and give you details. Please provide the data related to your runs."
          : response.text || 'I apologize, but I could not generate a response based on the available context.',
        agentId: agentId,
        contextUsed: contextDocs.length,
        relevanceScores: contextDocs.map(doc => ({
          source: doc.metadata?.source,
          score: doc.metadata?.score
        }))
      };

      console.log('Response generated:', {
        contextUsed: result.contextUsed,
        scoreCount: result.relevanceScores.length
      });

      return result;
    } catch (error) {
      console.error('Error in RAG process:', error);
      throw error;
    }
  }
} 