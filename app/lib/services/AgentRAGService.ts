import { GoogleGenAI } from '@google/genai';
import { Document } from 'langchain/document';
import { getAgentConfig, getAgentContext, AgentMetadata } from '../pinecone';
import { Message } from 'ai';
import { BaseRAGService, RAGResponse } from './BaseRAGService';
import { initializeGeminiModel } from '@/app/utils/modelInit';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

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

interface UnifiedContext {
  [category: string]: Document[];
}

interface ProcessedResponse {
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
    processedAt: number;
    insightCount: number;
    error?: string;
  };
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
    console.log(`[AgentRAGService] Gathering context for category: ${category}`);
    console.log(`[AgentRAGService] Agent ID: ${agentId}`);
    console.log(`[AgentRAGService] Query: ${query}`);

    try {
      // Get all context first
      const docs = await getAgentContext(agentId, query);
      console.log(`[AgentRAGService] Retrieved ${docs.length} total documents`);
      
      // Filter docs by category
      const categoryDocs = docs.filter(doc => {
        const docCategories = doc.metadata?.categories as string[] || [];
        return docCategories.includes(category);
      });
      
      console.log(`[AgentRAGService] Filtered ${categoryDocs.length} documents for category: ${category}`);

      // Log first few category docs for debugging
      categoryDocs.slice(0, 3).forEach((doc, i) => {
        console.log(`[AgentRAGService] Document ${i + 1} preview:`, {
          pageContent: doc.pageContent.substring(0, 100) + '...',
          metadata: doc.metadata,
          categories: doc.metadata?.categories
        });
      });

      // Filter for relevant docs (similarity > 0.7)
      const relevantDocs = categoryDocs.filter(doc => {
        const similarity = doc.metadata?.similarity as number;
        return similarity && similarity > 0.7;
      });

      console.log(`[AgentRAGService] Found ${relevantDocs.length} relevant documents (similarity > 0.7)`);
      console.log(`[AgentRAGService] Context gathering completed for category: ${category}`);

      return {
        category,
        docs: categoryDocs,
        relevantDocs
      };
    } catch (error) {
      console.error(`[AgentRAGService] Error gathering context for category ${category}:`, error);
      throw error;
    }
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

  private async clarifyQuery(query: string, messages: Message[]): Promise<string> {
    console.log('[AgentRAGService] Clarifying query:', query);

    try {
      const model = await initializeGeminiModel({
        maxOutputTokens: 1024,
        temperature: 0.3
      });

      const clarificationPrompt = `Your task is to clarify and focus the following query to improve context retrieval.
QUERY: "${query}"

REQUIREMENTS:
1. Extract the key information need
2. Remove any conversational elements
3. Focus on specific terms and concepts
4. Keep the clarified query concise
5. Maintain all important technical terms
6. Preserve any specific references (e.g., section numbers, specific terms)

Respond with ONLY the clarified query text, nothing else.`;

      const result = await model.call([
        { role: 'user', content: clarificationPrompt }
      ]);

      const clarifiedQuery = result.text.trim();
      
      // If clarification didn't improve the query significantly, use original
      if (
        clarifiedQuery.length < 10 || 
        clarifiedQuery.length > query.length * 1.5 ||
        clarifiedQuery === query
      ) {
        console.log('[AgentRAGService] Using original query as clarification did not improve it');
        return query;
      }

      console.log('[AgentRAGService] Query clarified:', clarifiedQuery);
      return clarifiedQuery;

    } catch (error) {
      console.error('[AgentRAGService] Error clarifying query:', error);
      return query;
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

  private processUnifiedContext(categoryContexts: CategoryContext[]): UnifiedContext {
    const unifiedContext: UnifiedContext = {};
    
    categoryContexts.forEach(ctx => {
      if (ctx.docs.length > 0) {
        unifiedContext[ctx.category] = ctx.docs;
      }
    });
    
    return unifiedContext;
  }

  private async createSystemPrompt(
    agentConfig: AgentMetadata,
    unifiedContext: UnifiedContext,
    recommendations: string[]
  ): Promise<string> {
    try {
      const contextSections = [];
      
      // Add category-specific context
      for (const category of Object.keys(unifiedContext)) {
        const docs = unifiedContext[category];
        if (docs.length > 0) {
          contextSections.push(`CATEGORY: ${category.toUpperCase()}`);
          contextSections.push(`RELEVANT DOCUMENTS (${docs.length}/${docs.length}):`);
          docs.forEach((doc: Document, i: number) => {
            contextSections.push(`${i + 1}. ${doc.pageContent}`);
          });
        }
      }

      // Add recommendations if any
      if (recommendations.length > 0) {
        contextSections.push('\nRECOMMENDATIONS:');
        recommendations.forEach(rec => contextSections.push(rec));
      }

      // Create the system prompt
      return `You are an AI assistant specializing in ${agentConfig.selectedContextIds[0]}.
Your task is to provide accurate, data-driven responses based on the available context.

CONTEXT INFORMATION:
${contextSections.join('\n')}

RESPONSE GUIDELINES:
1. ALWAYS base your response on the provided context
2. If the context doesn't contain the specific information requested:
   - Clearly state that the information is not in the provided context
   - Do not make up or infer information not supported by the context
   - Suggest what additional information would be helpful
3. When citing information:
   - Quote the relevant text directly from the context
   - Specify which document the information comes from
4. Focus on accuracy over comprehensiveness
5. If there are multiple relevant sections, compare and synthesize them

RESPONSE FORMAT:
You MUST respond with a JSON object in the following format:
{
  "insights": [
    {
      "insight": "Clear, specific observation supported by the context",
      "evidence": "Direct quote from the context, including document number",
      "confidence": number between 0-100,
      "category": "${agentConfig.selectedContextIds[0]}"
    }
  ],
  "response": "Natural language response that directly answers the query using information from the context",
  "metadata": {
    "responseTime": number,
    "contextUsed": boolean,
    "categoriesAnalyzed": ["${agentConfig.selectedContextIds[0]}"],
    "confidenceScore": number
  }
}

CONFIDENCE SCORE GUIDELINES:
- 90-100: Direct quote or explicit statement from context
- 70-89: Clear inference from context with supporting evidence
- 50-69: Reasonable interpretation with some supporting context
- 0-49: Limited or no supporting evidence from context

CRITICAL RULES:
1. NEVER make up information not present in the context
2. ALWAYS include relevant quotes as evidence
3. Be explicit about what information is and isn't in the context
4. If you can't find relevant information in the context, say so
5. Keep responses focused on ${agentConfig.selectedContextIds[0]} domain
6. Make insights specific and actionable
7. If the context is insufficient, explain what additional information would help`;
    } catch (error) {
      console.error('Error creating system prompt:', error);
      throw error;
    }
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

  private async processResponse(
    responseText: string, 
    requireInsights: boolean,
    agentConfig: AgentMetadata
  ): Promise<ProcessedResponse> {
    console.log('[AgentRAGService] Processing response');
    
    try {
      // Remove markdown formatting if present
      const cleanJson = responseText.replace(/```json\n|\n```|```/g, '').trim();
      
      // Parse JSON response
      const parsed = JSON.parse(cleanJson);
      
      // Validate response structure
      if (!parsed.response || (requireInsights && !Array.isArray(parsed.insights))) {
        throw new Error('Invalid response structure');
      }

      // Ensure all required metadata fields are present
      const metadata = {
        responseTime: parsed.metadata?.responseTime || 0,
        contextUsed: true,
        categoriesAnalyzed: [agentConfig.selectedContextIds[0]],
        confidenceScore: parsed.metadata?.confidenceScore || 0.8,
        processedAt: Date.now(),
        insightCount: parsed.insights?.length || 0
      };

      return {
        response: parsed.response,
        insights: parsed.insights || [],
        metadata
      };

    } catch (error) {
      console.warn('[AgentRAGService] Failed to parse JSON response:', error);
      console.log('[AgentRAGService] Raw response:', responseText);
      
      // Fallback: Use the entire response as plain text
      return {
        response: responseText,
        insights: requireInsights ? [{
          insight: 'Response format error',
          evidence: 'System was unable to format response correctly',
          confidence: 0,
          category: agentConfig.selectedContextIds[0]
        }] : [],
        metadata: {
          responseTime: 0,
          contextUsed: true,
          categoriesAnalyzed: [agentConfig.selectedContextIds[0]],
          confidenceScore: 0,
          processedAt: Date.now(),
          insightCount: 0,
          error: 'Failed to parse structured response'
        }
      };
    }
  }

  async generateResponse(agentId: string, messages: Message[]): Promise<RAGResponse> {
    try {
      console.log('[AgentRAGService] Starting response generation');
      const startTime = Date.now();

      // 1. Get agent configuration
      const agentConfig = await getAgentConfig(agentId);
      if (!agentConfig) {
        throw new Error('Agent configuration not found');
      }

      console.log('[AgentRAGService] Agent config:', {
        id: agentId,
        selectedContextIds: agentConfig.selectedContextIds
      });

      // 2. Get the latest user message
      const userMessage = messages[messages.length - 1];
      if (!userMessage || userMessage.role !== 'user') {
        throw new Error('Invalid message format');
      }

      // 3. Clarify the query for better context retrieval
      const clarifiedQuery = await this.clarifyQuery(userMessage.content, messages);
      console.log('[AgentRAGService] Clarified query:', clarifiedQuery);

      // 4. Get context from Pinecone for each selected category
      console.log('[AgentRAGService] Fetching context from Pinecone');
      const docs = await getAgentContext(agentId, clarifiedQuery);
      console.log(`[AgentRAGService] Retrieved ${docs.length} documents`);

      // Log context for debugging
      docs.forEach((doc, i) => {
        console.log(`[AgentRAGService] Document ${i + 1}:`, {
          preview: doc.pageContent.substring(0, 100) + '...',
          metadata: {
            categories: doc.metadata?.categories,
            category: doc.metadata?.category,
            score: doc.metadata?.score
          }
        });
      });

      // 5. Initialize the model
      const model = await initializeGeminiModel({
        maxOutputTokens: 2048,
        temperature: 0.7
      });

      // 6. Create system prompt with context
      const systemPrompt = `You are an AI assistant specializing in ${agentConfig.selectedContextIds[0]}.
Your task is to provide accurate, data-driven responses based on the available context.

CONTEXT INFORMATION:
${docs.map((doc, i) => `
DOCUMENT ${i + 1}:
${doc.pageContent}
---
`).join('\n')}

RESPONSE GUIDELINES:
1. ALWAYS base your response on the provided context
2. If the context doesn't contain the specific information requested:
   - Clearly state that the information is not in the provided context
   - Do not make up or infer information not supported by the context
   - Suggest what additional information would be helpful
3. When citing information:
   - Quote the relevant text directly from the context
   - Specify which document the information comes from
4. Focus on accuracy over comprehensiveness
5. If there are multiple relevant sections, compare and synthesize them

RESPONSE FORMAT:
You MUST respond with a JSON object in the following format:
{
  "insights": [
    {
      "insight": "Clear, specific observation supported by the context",
      "evidence": "Direct quote from the context, including document number",
      "confidence": number between 0-100,
      "category": "${agentConfig.selectedContextIds[0]}"
    }
  ],
  "response": "Natural language response that directly answers the query using information from the context",
  "metadata": {
    "responseTime": number,
    "contextUsed": boolean,
    "categoriesAnalyzed": ["${agentConfig.selectedContextIds[0]}"],
    "confidenceScore": number
  }
}

CONFIDENCE SCORE GUIDELINES:
- 90-100: Direct quote or explicit statement from context
- 70-89: Clear inference from context with supporting evidence
- 50-69: Reasonable interpretation with some supporting context
- 0-49: Limited or no supporting evidence from context

CRITICAL RULES:
1. NEVER make up information not present in the context
2. ALWAYS include relevant quotes as evidence
3. Be explicit about what information is and isn't in the context
4. If you can't find relevant information in the context, say so
5. Keep responses focused on ${agentConfig.selectedContextIds[0]} domain
6. Make insights specific and actionable
7. If the context is insufficient, explain what additional information would help`;

      // 7. Format conversation history
      const formattedHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system prompt at the beginning
      formattedHistory.unshift({
        role: 'system',
        content: systemPrompt
      });

      // 8. Generate response
      console.log('[AgentRAGService] Generating response with model');
      const result = await model.call(formattedHistory);
      const responseText = result.text;

      // 9. Process and structure the response
      console.log('[AgentRAGService] Processing response');
      const processedResponse = await this.processResponse(responseText, true, agentConfig);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 10. Return structured response with metrics
      return {
        success: true,
        response: processedResponse.response,
        agentId,
        contextUsed: docs.length,
        results: [{
          timestamp: endTime,
          success: true,
          responseTime,
          output: {
            insights: processedResponse.insights,
            metadata: {
              ...processedResponse.metadata,
              responseTime
            }
          },
          metrics: {
            contextRelevance: this.calculateContextRelevance(docs),
            insightQuality: this.calculateInsightQuality(processedResponse.insights),
            responseLatency: this.calculateResponseLatency(responseTime)
          }
        }],
        relevanceScores: docs.map(doc => ({
          source: String(doc.metadata?.source || 'unknown'),
          score: doc.metadata?.score || 0,
          category: agentConfig.selectedContextIds[0]
        })),
        // Provide the top 10 most similar context documents so the UI can
        // display them beneath the assistant response.
        closestMatches: [...docs]
          .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
          .slice(0, 10)
          .map(doc => ({
            contentPreview: doc.pageContent.substring(0, 200),
            source: String(doc.metadata?.source || 'unknown'),
            score: doc.metadata?.score || 0,
            category: String(doc.metadata?.category || agentConfig.selectedContextIds[0])
          })),
        categoryContexts: [{
          category: agentConfig.selectedContextIds[0],
          count: docs.length,
          relevantCount: docs.filter(doc => (doc.metadata?.score || 0) > 0.7).length
        }]
      };

    } catch (error) {
      console.error('[AgentRAGService] Error generating response:', error);
      throw error;
    }
  }

  private calculateContextRelevance(docs: Document[]): number {
    if (!docs.length) return 0;
    return docs.reduce((sum, doc) => sum + (doc.metadata?.score || 0), 0) / docs.length;
  }

  private calculateInsightQuality(insights: any[]): number {
    if (!insights?.length) return 0;
    return insights.reduce((sum, insight) => {
      const hasEvidence = Boolean(insight.evidence);
      const hasConfidence = typeof insight.confidence === 'number';
      const isSpecific = insight.insight?.length > 30;
      return sum + (hasEvidence ? 0.4 : 0) + (hasConfidence ? 0.3 : 0) + (isSpecific ? 0.3 : 0);
    }, 0) / insights.length;
  }

  private calculateResponseLatency(responseTime: number): number {
    const maxAcceptableTime = 10000; // 10 seconds
    return Math.max(0, Math.min(1, 1 - (responseTime / maxAcceptableTime)));
  }
}