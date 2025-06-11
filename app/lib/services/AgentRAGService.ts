import { GoogleGenAI } from '@google/genai';
import { Document } from 'langchain/document';
import { getAgentConfig, getAgentContext, AgentMetadata } from '../pinecone';
import { Message } from 'ai';
import { BaseRAGService, RAGResponse } from './BaseRAGService';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize the Google Gen AI client
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  apiVersion: 'v1'
});

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
  const recommendations: string[] = [];
  
  // Extract key terms from agent metadata
  const keyTerms = new Set([
    ...(agentConfig.category?.toLowerCase() || '').split(/\s+/),
    ...(agentConfig.description?.toLowerCase() || '').split(/\s+/),
    ...(agentConfig.agent?.useCases?.toLowerCase() || '').split(/\s+/)
  ]);

  // Define domain-specific data requirements
  const domainRequirements = {
    fitness: {
      terms: ['fitness', 'health', 'exercise', 'workout', 'running', 'training'],
      data: [
        { id: 'physical', desc: "Physical activity data with metrics like distance, duration, intensity, and personal feelings" },
        { id: 'nutrition', desc: "Nutrition and diet tracking data to correlate with physical performance" },
        { id: 'sleep', desc: "Sleep pattern data to understand recovery and performance relationships" }
      ]
    },
    finance: {
      terms: ['finance', 'money', 'transaction', 'budget', 'expense'],
      data: [
        { id: 'financial', desc: "Financial transaction data with timestamps, amounts, categories, and descriptions" },
        { id: 'investment', desc: "Investment portfolio data with holdings, performance metrics, and transaction history" },
        { id: 'budget', desc: "Budget and expense tracking data with spending categories and patterns" },
        { id: 'income', desc: "Income data with sources, amounts, and frequency information" }
      ]
    },
    productivity: {
      terms: ['work', 'productivity', 'professional', 'task', 'project'],
      data: [
        { id: 'work', desc: "Work activity logs with project names, task completion, productivity levels, and collaboration details" },
        { id: 'calendar', desc: "Calendar and meeting data to analyze time management patterns" },
        { id: 'communication', desc: "Communication logs to understand collaboration patterns" }
      ]
    },
    learning: {
      terms: ['learning', 'education', 'study', 'academic'],
      data: [
        { id: 'study', desc: "Study session logs with subjects, materials, comprehension levels, and learning outcomes" },
        { id: 'notes', desc: "Learning notes and knowledge base content for topic analysis and connections" },
        { id: 'progress', desc: "Progress tracking data across different subjects and learning goals" }
      ]
    },
    personal: {
      terms: ['personal', 'lifestyle', 'habit', 'routine'],
      data: [
        { id: 'routine', desc: "Daily routine and habit tracking with mood and consistency metrics" },
        { id: 'notes', desc: "Personal notes, thoughts, and reflections for pattern analysis" },
        { id: 'goals', desc: "Goal setting and achievement tracking across different life areas" }
      ]
    },
    business: {
      terms: ['customer', 'business', 'service', 'support'],
      data: [
        { id: 'support', desc: "Customer support interactions and ticket resolution data" },
        { id: 'feedback', desc: "Customer feedback and satisfaction survey responses" },
        { id: 'product', desc: "Product usage analytics and feature adoption metrics" }
      ]
    },
    analysis: {
      terms: ['data', 'analysis', 'insight', 'metrics'],
      data: [
        { id: 'metrics', desc: "Performance metrics and KPI tracking data with timestamps" },
        { id: 'trends', desc: "Historical trend data to enable time-series analysis and forecasting" }
      ]
    }
  };

  // Check each domain's requirements
  Object.values(domainRequirements).forEach(domain => {
    if (domain.terms.some(term => Array.from(keyTerms).some(keyTerm => keyTerm.includes(term) || term.includes(keyTerm)))) {
      domain.data.forEach(dataReq => {
        if (!selectedContextIds.some(id => id.toLowerCase().includes(dataReq.id))) {
          recommendations.push(dataReq.desc);
        }
      });
    }
  });

  // Add agent-specific recommendations based on capabilities
  if (agentConfig.agent?.capabilities?.length) {
    const missingCapabilityData = agentConfig.agent.capabilities
      .filter(cap => !selectedContextIds.some(id => id.toLowerCase().includes(cap.toLowerCase())))
      .map(cap => `Data relevant to the ${cap} capability`);
    recommendations.push(...missingCapabilityData);
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

export class AgentRAGService implements BaseRAGService {
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
        model: 'gemini-2.0-flash',
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
    } catch (_error) {
      console.error('❌ Query clarification failed, using original:', _error);
      return originalQuery;
    }
  }

  private formatContext(contextDocs: Document[]): string {
    if (contextDocs.length === 0) {
      return "No relevant context found. Please provide more information or rephrase your query.";
    }

    // Sort by relevance score and group by source/type
    const groupedDocs = contextDocs.reduce((acc, doc) => {
      const source = doc.metadata?.source || 'Unknown';
      if (!acc[source]) {
        acc[source] = [];
      }
      acc[source].push(doc);
      return acc;
    }, {} as Record<string, Document[]>);

    // Format each group of documents
    return Object.entries(groupedDocs)
      .map(([source, docs]) => {
        const sortedDocs = docs.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));
        const docsContent = sortedDocs.map((doc, index) => {
        const score = doc.metadata?.score ? Math.round(doc.metadata.score * 100) : 0;
          return `[Entry ${index + 1}] (Relevance: ${score}%)
${doc.pageContent}`;
      }).join('\n\n');

        return `=== ${source} ===\n${docsContent}\n---`;
      })
      .join('\n\n');
  }

  private createSystemPrompt(agentConfig: AgentMetadata, formattedContext: string, includeRecommendations: boolean = false, contextRecommendations: string = ''): string {
    // Generate analysis guidelines based on agent's category and capabilities
    const analysisGuidelines = this.generateAnalysisGuidelines(agentConfig);

    const basePrompt = `You are ${agentConfig.title || agentConfig.name}, an AI agent with expertise in ${agentConfig.primaryCategory || agentConfig.category || 'your assigned domain'}.

ROLE AND EXPERTISE:
- Primary Category: ${agentConfig.primaryCategory || agentConfig.category || 'Specialized Analysis'}
- Core Purpose: ${agentConfig.agent?.useCases || agentConfig.description || "Detailed analysis and insights"}
- Available Tools: ${Array.isArray(agentConfig.agent?.tools) ? agentConfig.agent.tools.join(", ") : "Analysis tools"}
- Capabilities: ${Array.isArray(agentConfig.agent?.capabilities) ? agentConfig.agent.capabilities.join(", ") : "Data analysis and insights"}

RESPONSE GUIDELINES:
1. ALWAYS analyze and reference the provided context in your responses
2. When analyzing the data:${analysisGuidelines}
3. Be specific and cite relevant data points
4. Provide numerical summaries when possible
5. Highlight important insights or patterns
6. If information is missing or unclear, explicitly state what's missing
7. Maintain a professional but conversational tone
8. Structure your response in a clear, organized manner

CONTEXT DOCUMENTS:
${formattedContext}`;

    if (includeRecommendations && contextRecommendations) {
      return basePrompt + `

IMPORTANT NOTES:
1. When you find gaps in the available data, suggest what additional information would help provide better insights
2. Recommended additional data: ${contextRecommendations}
3. Always provide concrete examples from the context to support your analysis
4. If you notice patterns or trends, explain their significance
5. When relevant, suggest actionable insights based on the data

Include these suggestions naturally in your response when appropriate.`;
    }

    return basePrompt;
  }

  /**
   * Generate analysis guidelines based on agent metadata
   */
  private generateAnalysisGuidelines(agentConfig: AgentMetadata): string {
    const category = agentConfig.category?.toLowerCase() || '';
    const description = agentConfig.description?.toLowerCase() || '';
    const useCases = agentConfig.agent?.useCases?.toLowerCase() || '';
    
    // Extract key terms from agent metadata
    const keyTerms = new Set([
      ...category.split(/\s+/),
      ...description.split(/\s+/),
      ...useCases.split(/\s+/)
    ]);

    const guidelines: string[] = [];

    // Data Analysis (common for all agents)
    guidelines.push(
      "   - Look for patterns and trends in the data",
      "   - Compare data points across time periods",
      "   - Identify significant variations",
      "   - Calculate relevant metrics",
      "   - Consider contextual factors"
    );

    // Add domain-specific guidelines based on key terms
    if (this.containsAnyTerm(keyTerms, ['finance', 'money', 'transaction', 'budget', 'expense'])) {
      guidelines.push(
        "   - Analyze transaction patterns and frequencies",
        "   - Calculate category-wise totals",
        "   - Identify recurring transactions",
        "   - Note unusual or significant amounts",
        "   - Track changes in spending patterns"
      );
    }

    if (this.containsAnyTerm(keyTerms, ['fitness', 'health', 'exercise', 'workout', 'running', 'training'])) {
      guidelines.push(
        "   - Analyze performance metrics and trends",
        "   - Compare results across sessions",
        "   - Consider intensity and effort levels",
        "   - Track progress towards goals",
        "   - Note environmental factors"
      );
    }

    if (this.containsAnyTerm(keyTerms, ['learning', 'education', 'study', 'academic'])) {
      guidelines.push(
        "   - Track learning progress and outcomes",
        "   - Analyze study patterns and effectiveness",
        "   - Identify areas of improvement",
        "   - Compare performance across subjects",
        "   - Note learning milestones"
      );
    }

    if (this.containsAnyTerm(keyTerms, ['productivity', 'work', 'task', 'project'])) {
      guidelines.push(
        "   - Analyze task completion patterns",
        "   - Track time management metrics",
        "   - Identify productivity trends",
        "   - Note workflow optimizations",
        "   - Compare performance across projects"
      );
    }

    // Add any agent-specific capabilities as guidelines
    if (agentConfig.agent?.capabilities?.length) {
      const capabilityGuidelines = agentConfig.agent.capabilities.map(cap => 
        `   - Utilize ${cap} when relevant`
      );
      guidelines.push(...capabilityGuidelines);
    }

    return '\n' + guidelines.join('\n');
  }

  /**
   * Check if any term from the search terms exists in the key terms
   */
  private containsAnyTerm(keyTerms: Set<string>, searchTerms: string[]): boolean {
    return searchTerms.some(term => 
      Array.from(keyTerms).some(keyTerm => 
        keyTerm.includes(term) || term.includes(keyTerm)
      )
    );
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
        model: 'gemini-2.0-flash',
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
    } catch (_error) {
      console.error('Error in RAG process:', _error);
      throw _error;
    }
  }
} 