import { Document } from 'langchain/document';
import { getAgentConfig, getAgentContext, AgentMetadata } from '../pinecone';
import { Message } from 'ai';
import { BaseRAGService, RAGResponse } from './BaseRAGService';
import { initializeGeminiModel } from '@/app/utils/modelInit';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

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

export class RetrievalService implements BaseRAGService {
  private readonly MAX_CATEGORIES = 2;

  private validateCategories(categories: string[]): { primaryCategory: string; secondaryCategory?: string } {
    if (!categories.length) {
      throw new Error("At least one category is required");
    }
    if (categories.length > this.MAX_CATEGORIES) {
      console.warn(`More than ${this.MAX_CATEGORIES} categories provided. Using only the first two.`);
    }
    return {
      primaryCategory: categories[0],
      secondaryCategory: categories[1]
    };
  }

  private async gatherCategoryContext(agentId: string, query: string, category: string): Promise<{ category: string; docs: Document[] }> {
    console.log(`Gathering context for category: ${category}`);
    try {
      const docs = await getAgentContext(agentId, query);
      return {
        category,
        docs
      };
    } catch (error) {
      console.error(`Error gathering context for category ${category}:`, error);
      return {
        category,
        docs: []
      };
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
      const model = await initializeGeminiModel({
        maxOutputTokens: 2048,
        temperature: 0.3
      });

      const result = await model.call([
        { role: 'user', content: clarificationPrompt }
      ]);

      const clarifiedQuery = result.text?.trim() || originalQuery;
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

  async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    try {
      console.log('Generating response for agent:', agentId);
      const startTime = Date.now();

      // Get agent configuration
      const agentConfig = await getAgentConfig(agentId);
      if (!agentConfig) {
        throw new Error('Agent configuration not found');
      }

      // Get the latest user message
      const userMessage = messages[messages.length - 1];
      if (!userMessage || userMessage.role !== 'user') {
        throw new Error('Invalid message format');
      }

      // Clarify the query
      const clarifiedQuery = await this.clarifyQuery(userMessage.content, messages);
      console.log('Clarified query:', clarifiedQuery);

      // Gather context from all selected categories
      const categoryContexts = await Promise.all(
        (agentConfig.selectedContextIds || []).map(category =>
          this.gatherCategoryContext(agentId, clarifiedQuery, category)
        )
      );

      // Initialize the model
      const model = await initializeGeminiModel({
        maxOutputTokens: 2048,
        temperature: 0.7
      });

      // Create system prompt
      const systemPrompt = `You are an AI assistant specializing in ${agentConfig.category}.
Your task is to provide accurate, data-driven responses based on the available context.

CONTEXT INFORMATION:
${categoryContexts.map(ctx => `
CATEGORY: ${ctx.category.toUpperCase()}
${this.formatContext(ctx.docs)}
`).join('\n')}

RESPONSE REQUIREMENTS:
You MUST respond with a JSON object in the following format:
{
  "insights": [
    {
      "insight": "Clear, specific observation about ${agentConfig.category}",
      "evidence": "Direct quote or reference from context",
      "confidence": number between 0-100,
      "category": "${agentConfig.category}"
    }
  ],
  "response": "Natural language response to the query",
  "metadata": {
    "responseTime": number,
    "contextUsed": boolean,
    "categoriesAnalyzed": ["${agentConfig.category}"],
    "confidenceScore": number
  }
}

CRITICAL RULES:
1. ALWAYS include at least one insight, even for simple queries
2. Use the exact category name "${agentConfig.category}" in the response
3. Base confidence scores on evidence strength
4. Include relevant context quotes as evidence
5. Keep insights focused on ${agentConfig.category} domain
6. Make insights specific and actionable`;

      // Format conversation history for the model
      const formattedHistory = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'human' : 'assistant',
          content: msg.content
        }))
      ];

      // Generate response
      const result = await model.call(formattedHistory);
      const responseText = result.text;
      
      // Process the response
      const processedResponse = await this.processResponse(responseText);
      
      return {
        success: true,
        response: processedResponse.response,
        agentId,
        contextUsed: categoryContexts.reduce((total, ctx) => total + ctx.docs.length, 0),
        results: [{
          timestamp: Date.now(),
          success: true,
          responseTime: Date.now() - startTime,
          output: {
            insights: processedResponse.insights,
            metadata: processedResponse.metadata
          },
          metrics: {
            contextRelevance: 0.8,
            insightQuality: 0.8,
            responseLatency: Date.now() - startTime
          }
        }],
        relevanceScores: categoryContexts.flatMap(ctx => 
          ctx.docs.map(doc => ({
            source: doc.metadata?.source || 'unknown',
            score: doc.metadata?.score || 0,
            category: ctx.category
          }))
        ),
        categoryContexts: categoryContexts.map(ctx => ({
          category: ctx.category,
          count: ctx.docs.length,
          relevantCount: ctx.docs.filter(doc => (doc.metadata?.score ?? 0) > 0.7).length
        }))
      };

    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  private async processResponse(responseText: string): Promise<{
    response: string;
    insights: Array<{
      insight: string;
      evidence: string;
      confidence: number;
      category: string;
    }>;
    metadata: {
      responseTime: number;
      contextUsed: boolean;
      categoriesAnalyzed: string[];
      confidenceScore: number;
    };
  }> {
    try {
      // Remove any markdown formatting if present
      const cleanJson = responseText.replace(/```json|```|\n/g, '').trim();
      
      // If the response is not JSON, return empty insights
      if (!cleanJson.startsWith('{')) {
        return {
          response: '',
          insights: [],
          metadata: {
            responseTime: 0,
            contextUsed: false,
            categoriesAnalyzed: [],
            confidenceScore: 0.8
          }
        };
      }

      // Try to parse as JSON
      const parsedResponse = JSON.parse(cleanJson);
      
      return {
        response: parsedResponse.response || '',
        insights: parsedResponse.insights || [],
        metadata: {
          responseTime: parsedResponse.metadata?.responseTime || 0,
          contextUsed: parsedResponse.metadata?.contextUsed || false,
          categoriesAnalyzed: parsedResponse.metadata?.categoriesAnalyzed || [],
          confidenceScore: parsedResponse.metadata?.confidenceScore || 0.8
        }
      };
    } catch (error) {
      console.error('Failed to parse response:', error);
      return {
        response: '',
        insights: [],
        metadata: {
          responseTime: 0,
          contextUsed: false,
          categoriesAnalyzed: [],
          confidenceScore: 0.8
        }
      };
    }
  }

  async processRetrievalRequest(
    query: string,
    userId: string,
    contextType?: string
  ) {
    const result = await this.generateResponse('default', [{
      id: `msg_${Date.now()}`,
      role: 'user',
      content: query
    }]);
    return {
      contentId: result.agentId,
      text: result.response,
      createdAt: new Date().toISOString()
    };
  }
} 