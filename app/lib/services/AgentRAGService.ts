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

interface CategoryContext {
  category: string;
  docs: Document[];
  relevantDocs: Document[];
}

interface AgentResponse {
  insights?: Array<{
    insight: string;
    evidence: string;
    confidence: number;
    category: string;
  }>;
  response?: string;
  metadata: {
    responseTime: number;
    contextUsed: boolean;
    categoriesAnalyzed: string[];
    confidenceScore: number;
  };
  error?: string;
}

export class AgentRAGService implements BaseRAGService {
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

  private async gatherCategoryContext(agentId: string, query: string, category: string): Promise<CategoryContext> {
    console.log(`Gathering context for category: ${category}`);
    const docs = await getAgentContext(agentId, `${query} ${category}`);
    return {
      category,
      docs,
      relevantDocs: docs.filter(doc => (doc.metadata?.score ?? 0) > 0.7)
    };
  }

  private formatCategoryContext(context: CategoryContext): string {
    return `
CATEGORY: ${context.category.toUpperCase()}
RELEVANT DOCUMENTS (${context.relevantDocs.length}/${context.docs.length}):
${context.relevantDocs.map(doc => `
SOURCE: ${doc.metadata?.source || 'Unknown'}
CONTENT: ${doc.pageContent}
`).join('\n')}

ADDITIONAL CONTEXT (${context.docs.length - context.relevantDocs.length} documents):
${context.docs.filter(doc => (doc.metadata?.score ?? 0) <= 0.7)
  .map(doc => doc.pageContent)
  .join('\n')}`;
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
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [{ role: 'user', parts: [{ text: clarificationPrompt }] }],
        config: {
          maxOutputTokens: 2048,
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

  private processUnifiedContext(contexts: CategoryContext[]): string {
    return contexts
      .map(context => this.formatCategoryContext(context))
      .join('\n\n');
  }

  private createSystemPrompt(
    agentConfig: AgentMetadata,
    context: string,
    requireInsights: boolean = false,
    recommendations: string[] = []
  ): string {
    const category = agentConfig.category || (agentConfig.selectedContextIds && agentConfig.selectedContextIds[0]) || 'general';
    let prompt = `You are an AI assistant specializing in ${category}.
Your task is to provide accurate, data-driven responses based on the available context.

CONTEXT INFORMATION:
${context}

${recommendations.length ? `RECOMMENDATIONS:\n${recommendations.join('\n')}\n` : ''}

RESPONSE REQUIREMENTS:
You MUST respond with a JSON object in the following format:
{
  "insights": [
    {
      "insight": "Clear, specific observation about ${category}",
      "evidence": "Direct quote or reference from context",
      "confidence": number between 0-100,
      "category": "${category}"
    }
  ],
  "response": "Natural language response to the query",
  "metadata": {
    "responseTime": number,
    "contextUsed": boolean,
    "categoriesAnalyzed": ["${category}"],
    "confidenceScore": number
  }
}

CRITICAL RULES:
1. ALWAYS include at least one insight, even for simple queries
2. Use the exact category name "${category}" in the response
3. Base confidence scores on evidence strength
4. Include relevant context quotes as evidence
5. Keep insights focused on ${category} domain
6. Make insights specific and actionable`;

    return prompt;
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

  private generateContextRecommendations(agentConfig: AgentMetadata, categoryContexts: { category: string, docs: Document[] }[]): string[] {
    const missingCategories = (agentConfig.selectedContextIds || [])
      .filter(category => !categoryContexts.some(ctx => ctx.category === category && ctx.docs.length > 0));

    if (missingCategories.length === 0) {
      return [];
    }

    return missingCategories
      .map(category => `- ${category.charAt(0).toUpperCase() + category.slice(1)} related documents and data`);
  }

  async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    console.log('\n=== STEP 1: AGENT SCOPE ===');
    const agentConfig = await getAgentConfig(agentId);
    console.log('Agent Name:', agentConfig.name);
    // Get primary category from either category field or first selectedContextId
    const primaryCategory = agentConfig.category || (agentConfig.selectedContextIds && agentConfig.selectedContextIds[0]) || 'general';
    const secondaryCategory = agentConfig.selectedContextIds && agentConfig.selectedContextIds[1];
    console.log('Primary Category:', primaryCategory);
    console.log('Secondary Category:', secondaryCategory || 'None');

    // Step 2: Gather context for each category
    console.log('\n=== STEP 2: GATHERING CONTEXT ===');
    const categoryContexts = await Promise.all([
      this.gatherCategoryContext(agentId, messages[messages.length - 1].content, primaryCategory),
      secondaryCategory ? 
        this.gatherCategoryContext(agentId, messages[messages.length - 1].content, secondaryCategory) : 
        Promise.resolve(null)
    ]);

    // Step 3: Process and unify context
    console.log('\n=== STEP 3: PROCESSING UNIFIED CONTEXT ===');
    const validContexts = categoryContexts.filter((ctx): ctx is CategoryContext => ctx !== null);
    const unifiedContext = this.processUnifiedContext(validContexts);
    console.log('Total documents across categories:', validContexts.reduce((sum, ctx) => sum + ctx.docs.length, 0));

    // Step 4: Generate response with unified context
    console.log('\n=== STEP 4: GENERATING RESPONSE ===');
    const requireInsights = messages[messages.length - 1].content.toLowerCase().includes('generate 3 insights');
    
      const systemPrompt = this.createSystemPrompt(
        agentConfig, 
      unifiedContext,
      requireInsights,
      this.generateContextRecommendations(agentConfig, validContexts)
      );

      // Format conversation history
      const fullConversation = this.formatConversationHistory(messages, systemPrompt);

      // Generate response using the model
    const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
      contents: fullConversation
      });

    const responseText = response.text?.trim() || '';
    const processedResponse = await this.processResponse(responseText, requireInsights);
    
    const responseForReturn = requireInsights ? processedResponse : processedResponse.response || '';
    
    return {
      success: true,
      response: JSON.stringify(responseForReturn),
      agentId,
      contextUsed: validContexts.reduce((sum, ctx) => sum + ctx.docs.length, 0),
      results: [{
        timestamp: Date.now(),
        success: true,
        responseTime: Date.now() - startTime,
        output: {
          insights: processedResponse.insights || [],
          metadata: {
            responseTime: Date.now() - startTime,
            contextUsed: validContexts.length > 0,
            categoriesAnalyzed: validContexts.map(ctx => ctx.category),
            confidenceScore: processedResponse.metadata?.confidenceScore || 0
          }
        },
        metrics: {
          contextRelevance: validContexts.reduce((avg, ctx) => 
            avg + (ctx.relevantDocs.length / Math.max(ctx.docs.length, 1)), 0) / Math.max(validContexts.length, 1),
          insightQuality: processedResponse.insights ? 
            processedResponse.insights.reduce((avg, insight) => avg + (insight.confidence / 100), 0) / processedResponse.insights.length : 
            0,
          responseLatency: Date.now() - startTime
        }
      }],
      relevanceScores: validContexts.flatMap(ctx => 
        ctx.docs.map(doc => ({
          source: doc.metadata?.source || 'unknown',
          score: doc.metadata?.score || 0,
          category: ctx.category
        }))
      ),
      categoryContexts: validContexts.map(ctx => ({
        category: ctx.category,
        count: ctx.docs.length,
        relevantCount: ctx.relevantDocs.length
        }))
      };
  }

  private async processResponse(responseText: string, requireInsights: boolean): Promise<AgentResponse> {
    try {
      // Remove any markdown formatting if present
      const cleanJson = responseText.replace(/\`\`\`json|\`\`\`|\n/g, '').trim();
      console.log('[DEBUG] Raw response:', responseText);
      console.log('[DEBUG] Cleaned JSON:', cleanJson);
      
      const parsedResponse = JSON.parse(cleanJson);
      console.log('[DEBUG] Parsed response:', parsedResponse);
      
      const response = {
        insights: parsedResponse.insights || [],
        response: parsedResponse.response || responseText,
        metadata: {
          responseTime: parsedResponse.metadata?.responseTime || 0,
          contextUsed: parsedResponse.metadata?.contextUsed || false,
          categoriesAnalyzed: parsedResponse.metadata?.categoriesAnalyzed || [],
          confidenceScore: parsedResponse.metadata?.confidenceScore || 0
        }
      };
      
      console.log('[DEBUG] Processed response with insights:', response);
      return response;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      // Return a structured error response
      return {
        insights: [],
        response: responseText,
        metadata: {
          responseTime: 0,
          contextUsed: false,
          categoriesAnalyzed: [],
          confidenceScore: 0
        },
        error: 'Failed to generate structured insights'
      };
    }
  }
} 