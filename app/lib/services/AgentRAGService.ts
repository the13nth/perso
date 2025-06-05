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

const QUERY_CLARIFICATION_PROMPT = `You are a query understanding assistant. Your job is to analyze user queries and make them more explicit and searchable for a document retrieval system.

Given the user's query and chat history, create a clear, standalone search query that captures what the user is really looking for.

Guidelines:
1. Make implicit references explicit (e.g., "that document" → "the document about X mentioned earlier")
2. Add relevant context from chat history if needed
3. Expand abbreviations and unclear terms
4. If the query is already clear and specific, return it as-is
5. Focus on what the user wants to find, not how they want it presented
6. Keep it concise but comprehensive
7. If the user is asking for analysis or comparison, clarify what they want analyzed

Chat History:
{chat_history}

Original Query: {original_query}

Please provide only the clarified query without any additional explanation.`;

// Helper function to generate context enhancement recommendations
function generateContextRecommendations(
  agentConfig: AgentMetadata, 
  contextUsed: number,
  selectedContextIds: string[]
): string {
  const agentCategory = agentConfig.category?.toLowerCase() || '';
  
  const recommendations: string[] = [];
  
  // Analyze what's missing based on agent type
  if (agentCategory.includes('fitness') || agentCategory.includes('health') || agentCategory.includes('physical')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('physical'))) {
      recommendations.push("Physical activity data (running, workouts, sports) with metrics like distance, duration, intensity, and personal feelings");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('nutrition'))) {
      recommendations.push("Nutrition and diet tracking data to correlate with physical performance");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('sleep'))) {
      recommendations.push("Sleep pattern data to understand recovery and performance relationships");
    }
  }
  
  if (agentCategory.includes('financial') || agentCategory.includes('finance') || agentCategory.includes('money') || agentCategory.includes('advisor')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('financial') || id.toLowerCase().includes('finance'))) {
      recommendations.push("Financial transaction data with timestamps, amounts, categories, and descriptions");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('investment') || id.toLowerCase().includes('portfolio'))) {
      recommendations.push("Investment portfolio data with holdings, performance metrics, and transaction history");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('budget') || id.toLowerCase().includes('expense'))) {
      recommendations.push("Budget and expense tracking data with spending categories and patterns");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('income') || id.toLowerCase().includes('salary'))) {
      recommendations.push("Income data with sources, amounts, and frequency information");
    }
  }
  
  if (agentCategory.includes('work') || agentCategory.includes('productivity') || agentCategory.includes('professional')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('work'))) {
      recommendations.push("Work activity logs with project names, task completion, productivity levels, and collaboration details");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('calendar'))) {
      recommendations.push("Calendar and meeting data to analyze time management patterns");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('communication'))) {
      recommendations.push("Communication logs (emails, messages) to understand collaboration patterns");
    }
  }
  
  if (agentCategory.includes('learning') || agentCategory.includes('education') || agentCategory.includes('study')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('study'))) {
      recommendations.push("Study session logs with subjects, materials, comprehension levels, and learning outcomes");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('notes'))) {
      recommendations.push("Learning notes and knowledge base content for topic analysis and connections");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('progress'))) {
      recommendations.push("Progress tracking data across different subjects and learning goals");
    }
  }
  
  if (agentCategory.includes('personal') || agentCategory.includes('lifestyle')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('routine'))) {
      recommendations.push("Daily routine and habit tracking with mood and consistency metrics");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('notes'))) {
      recommendations.push("Personal notes, thoughts, and reflections for pattern analysis");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('goals'))) {
      recommendations.push("Goal setting and achievement tracking across different life areas");
    }
  }
  
  // Business/Customer Service specific recommendations
  if (agentCategory.includes('customer') || agentCategory.includes('business') || agentCategory.includes('service')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('support'))) {
      recommendations.push("Customer support interactions and ticket resolution data");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('feedback'))) {
      recommendations.push("Customer feedback and satisfaction survey responses");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('product'))) {
      recommendations.push("Product usage analytics and feature adoption metrics");
    }
  }
  
  // Data Analysis specific recommendations
  if (agentCategory.includes('data') || agentCategory.includes('analysis') || agentCategory.includes('insight')) {
    if (selectedContextIds.length < 5) {
      recommendations.push("More structured data with consistent field schemas for better pattern recognition");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('metrics'))) {
      recommendations.push("Performance metrics and KPI tracking data with timestamps");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('trends'))) {
      recommendations.push("Historical trend data to enable time-series analysis and forecasting");
    }
  }
  
  // Generic recommendations based on current limitations
  if (selectedContextIds.length < 3) {
    recommendations.push("Additional complementary data categories to enable cross-category insights and correlations");
  }
  
  if (contextUsed === 0) {
    recommendations.push("Any relevant data uploads to get started with personalized insights and analysis");
  }
  
  if (recommendations.length === 0) {
    recommendations.push("Consider adding timestamped data for trend analysis over time");
    recommendations.push("Cross-referenced data from related activities could provide additional insights");
  }
  
  return recommendations.length > 0 ? recommendations.join(', ') : '';
}

export class AgentRAGService {
  private async clarifyQuery(originalQuery: string, chatHistory: Message[]): Promise<string> {
    console.log('🧠 Clarifying query:', originalQuery);
    
    try {
      // Format chat history for context
      const chatHistoryText = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
      
      // Create the clarification prompt
      const clarificationPrompt = QUERY_CLARIFICATION_PROMPT
        .replace('{chat_history}', chatHistoryText)
        .replace('{original_query}', originalQuery);

      // Generate clarified query
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-001',
        contents: [{ role: 'user', parts: [{ text: clarificationPrompt }] }],
        config: {
          maxOutputTokens: 512,
          temperature: 0.3
        }
      });

      const clarifiedQuery = response.text?.trim() || originalQuery;
      console.log('✨ Clarified query:', clarifiedQuery);
      
      // If the clarified query is too similar to original or seems like it didn't improve, use original
      if (clarifiedQuery.toLowerCase() === originalQuery.toLowerCase() || 
          clarifiedQuery.length < originalQuery.length * 0.8) {
        console.log('📝 Using original query as clarification didn\'t improve it significantly');
        return originalQuery;
      }
      
      return clarifiedQuery;
    } catch (error) {
      console.error('❌ Query clarification failed, using original:', error);
      return originalQuery;
    }
  }

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

  private createSystemPrompt(agentConfig: AgentMetadata, formattedContext: string, includeRecommendations: boolean = false, contextRecommendations: string = ''): string {
    const basePrompt = `You are ${agentConfig.name}, an AI agent with expertise in ${agentConfig.category}.

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
${formattedContext}`;

    if (includeRecommendations && contextRecommendations) {
      return basePrompt + `

IMPORTANT: When you have limited or no context to provide a comprehensive answer, you should suggest what additional data would help you provide better insights. Specifically recommend uploading: ${contextRecommendations}

Include these suggestions naturally in your response when context is insufficient.`;
    }

    return basePrompt + `

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

      // Step 1: Clarify the query using chat history context
      const chatHistory = messages.slice(0, -1); // All messages except the last one
      const clarifiedQuery = await this.clarifyQuery(lastUserMessage.content, chatHistory);

      // Step 2: Get agent configuration and context using the clarified query
      const [agentConfig, contextDocs] = await Promise.all([
        getAgentConfig(agentId),
        getAgentContext(agentId, clarifiedQuery)
      ]);

      console.log('Retrieved context documents:', contextDocs.length);
      console.log('Agent config:', {
        name: agentConfig.name,
        category: agentConfig.category,
        description: agentConfig.description
      });

      // Step 3: If clarified query returns no context, try with original query as fallback
      let finalContextDocs = contextDocs;
      if (contextDocs.length === 0 && clarifiedQuery !== lastUserMessage.content) {
        console.log('🔄 No context with clarified query, trying original query as fallback');
        finalContextDocs = await getAgentContext(agentId, lastUserMessage.content);
        console.log('📄 Fallback context documents:', finalContextDocs.length);
      }

      // Generate context enhancement recommendations
      const contextRecommendations = generateContextRecommendations(
        agentConfig,
        finalContextDocs.length,
        agentConfig.selectedContextIds || []
      );

      // Format context and create system prompt - always include recommendations for better guidance
      const formattedContext = this.formatContext(finalContextDocs);
      const systemPrompt = this.createSystemPrompt(
        agentConfig, 
        formattedContext, 
        true, // Always include recommendations for better user guidance
        contextRecommendations
      );

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

      let responseText = response.text || 'I apologize, but I could not generate a response based on the available context.';

      // If no context available, provide a helpful response with recommendations
      if (finalContextDocs.length === 0) {
        responseText = `I'd be happy to help you, but I don't currently have access to relevant data to answer your question comprehensively.

To provide you with personalized insights and analysis, I would need you to upload some data related to ${agentConfig.category}. Specifically, uploading the following types of information would greatly enhance my ability to help:

${contextRecommendations}

You can upload this data through the "Add Content" button in the chat interface, which will allow me to provide much more detailed and personalized responses to your questions.

Is there anything specific about ${agentConfig.category} that you'd like me to help you with once you've uploaded some relevant data?`;
      }
      // If context exists but response indicates inability to fulfill request, add recommendations
      else if (responseText.toLowerCase().includes('cannot') || responseText.toLowerCase().includes('sorry') || responseText.toLowerCase().includes('unable')) {
        responseText += `\n\nTo better assist you with questions like this, consider uploading: ${contextRecommendations}

You can add this data using the "Add Content" button, which will enable me to provide more detailed and accurate responses to your queries.`;
      }

      const result: RAGResponse = {
        success: true,
        response: responseText,
        agentId: agentId,
        contextUsed: finalContextDocs.length,
        relevanceScores: finalContextDocs.map(doc => ({
          source: doc.metadata?.source,
          score: doc.metadata?.score
        }))
      };

      console.log('Response generated:', {
        contextUsed: result.contextUsed,
        scoreCount: result.relevanceScores.length,
        includesRecommendations: true
      });

      return result;
    } catch (error) {
      console.error('Error in RAG process:', error);
      throw error;
    }
  }
} 