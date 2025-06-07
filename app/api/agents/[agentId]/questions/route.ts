import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Adjust timeout for Netlify - more realistic deployment constraints
const NETLIFY_TIMEOUT_MS = 25000; // 25 seconds (safer for Netlify)

// Helper function to check if we're running out of time
function isTimeoutApproaching(requestStartTime: number): boolean {
  const elapsed = Date.now() - requestStartTime;
  return elapsed > (NETLIFY_TIMEOUT_MS - 5000); // Leave 5 seconds buffer, be less aggressive
}

// Optimized timeout wrapper for async operations
async function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  fallback: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => 
      setTimeout(() => resolve(fallback), timeoutMs)
    )
  ]);
}

// Updated question generation template that uses actual user data content
const DATA_DRIVEN_QUESTION_TEMPLATE = `You are helping generate relevant questions that a user can ask an AI agent about their data.

AGENT CONTEXT:
Name: {agentName}
Purpose: {agentDescription}
Domain: {agentCategory}
Data Access: {selectedContextIds}

USER'S DATA:
{actualDataSamples}

Data Categories: {userCategories}
Content Types: {userContentTypes}

Based on the agent's purpose and the user's actual data, generate 3 engaging questions that the user could ask this AI agent. The questions should be tailored based on the available content types:

For Running Context (activity logs, real-time data):
- Focus on patterns, trends, and real-time insights
- Reference specific metrics and activities
- Ask about performance improvements and recommendations
Example: "What patterns do you see in my daily [activity] over the past month?"

For Document Context (notes, knowledge base):
- Focus on content analysis and knowledge extraction
- Reference specific topics or themes
- Ask about insights and connections between documents
Example: "Can you analyze my notes about [topic] and identify key concepts?"

For Mixed Context (both running and document data):
- Combine insights from both types of data
- Look for correlations between activities and documented knowledge
- Ask about comprehensive patterns and relationships
Example: "How do my documented goals align with my actual activities?"

Generate questions that:
1. Help users understand insights from their specific data types
2. Explore patterns and trends appropriate to the context
3. Get personalized recommendations based on available data

If there isn't enough data, respond with:
NOT_ENOUGH_DATA

Otherwise, format your response as a simple numbered list:
1. [First Question]
2. [Second Question]
3. [Third Question]

IMPORTANT: Use ONLY the numbered list format above, no other text or formatting.`;

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

// Initialize Pinecone and embeddings for data fetching
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY || "",
  modelName: "embedding-001",
});

// Fetch actual user data samples from their selected contexts
async function fetchUserDataSamples(selectedContextIds: string[], userId: string, requestStartTime: number): Promise<{
  sampleData: string[];
  categories: string[];
  contentTypes: string[];
}> {
  console.log('🚀 Starting fetchUserDataSamples with:', { selectedContextIds, userId });
  
  if (isTimeoutApproaching(requestStartTime)) {
    console.log('⚠️ Timeout approaching, returning early');
    return { sampleData: [], categories: [], contentTypes: [] };
  }

  try {
    console.log('📌 Initializing Pinecone index...');
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    console.log('🔍 Creating query embedding...');
    const queryEmbedding = await embeddings.embedQuery("financial data content sample");
    console.log('✅ Query embedding created');
    
    // Simplified and more inclusive filter
    const contextFilter = {
      $and: [
        { userId: { $eq: userId } },
        {
          $or: [
            // Match by type and category
            {
              $and: [
                {
                  type: {
                    $in: [
                      "comprehensive_activity",
                      "activity_log",
                      "running_context",
                      "document",
                      "note",
                      "knowledge_base",
                      "document_context",
                      "financial_data",
                      "transaction",
                      "financial_record"
                    ]
                  }
                },
                {
                  $or: [
                    // Direct category matches
                    { category: { $in: selectedContextIds } },
                    { primaryCategory: { $in: selectedContextIds } },
                    { secondaryCategories: { $in: selectedContextIds } },
                    // Context ID matches
                    { contextId: { $in: selectedContextIds } },
                    // Activity matches
                    { activity: { $in: selectedContextIds } },
                    { activityType: { $in: selectedContextIds } },
                    // Financial specific matches
                    { transactionType: { $in: selectedContextIds } },
                    { financialCategory: { $in: selectedContextIds } }
                  ]
                }
              ]
            },
            // Match by context ID
            { contextId: { $in: selectedContextIds } },
            // Match by any financial indicator
            {
              $or: [
                { isFinancial: true },
                { domain: "finance" },
                { category: "finance" },
                { type: "financial_data" }
              ]
            }
          ]
        }
      ]
    };

    console.log('🔎 Querying Pinecone with filter:', JSON.stringify(contextFilter, null, 2));

    // Increase topK for better coverage
    const queryResponse = await index.query({
      vector: queryEmbedding,
      filter: contextFilter,
      topK: 20,
      includeMetadata: true
    });
    
    console.log('📦 Query response:', JSON.stringify(queryResponse, null, 2));

    // Extract unique categories and content types
    const categories = new Set<string>();
    const contentTypes = new Set<string>();
    const samples: string[] = [];

    console.log('🔄 Processing query results...');
    if (queryResponse.matches && queryResponse.matches.length > 0) {
      queryResponse.matches.forEach(match => {
        console.log('📄 Processing match:', match.id);
        if (match.metadata) {
          // Add categories from all possible fields
          const possibleCategoryFields = [
            'categories',
            'category',
            'activityCategory',
            'primaryCategory',
            'secondaryCategories',
            'contextCategories',
            'financialCategory',
            'transactionCategory'
          ];

          possibleCategoryFields.forEach(field => {
            const value = match.metadata![field];
            if (Array.isArray(value)) {
              value.forEach(cat => categories.add(cat));
            } else if (typeof value === 'string') {
              categories.add(value);
            }
          });
          
          // Add content types from all possible fields
          const possibleTypeFields = [
            'type',
            'activityType',
            'contentType',
            'documentType',
            'contextType',
            'transactionType',
            'financialType'
          ];

          possibleTypeFields.forEach(field => {
            const value = match.metadata![field];
            if (typeof value === 'string') {
              contentTypes.add(value);
            }
          });
          
          // Add text sample - handle all possible content fields
          const possibleContentFields = [
            'text',
            'content',
            'searchableText',
            'description',
            'summary',
            'activityData',
            'documentContent',
            'transactionDetails',
            'financialData'
          ];

          for (const field of possibleContentFields) {
            const content = match.metadata![field];
            if (typeof content === 'string' && content.trim()) {
              samples.push(content);
              break; // Take the first non-empty content field
            }
          }
        }
      });
    }

    // If no data found, add finance-specific categories
    if (categories.size === 0) {
      categories.add('finances');
      contentTypes.add('financial_data');
    }

    console.log('📊 Results summary:', {
      samplesFound: samples.length,
      uniqueCategories: Array.from(categories),
      uniqueContentTypes: Array.from(contentTypes)
    });

    return {
      sampleData: samples,
      categories: Array.from(categories),
      contentTypes: Array.from(contentTypes)
    };

  } catch (error) {
    console.error('❌ Error in fetchUserDataSamples:', error);
    throw error;
  }
}

// Data-driven fallback question generation using actual user content
function generateDataDrivenFallbackQuestions(
  agentConfig: Record<string, unknown>, 
  userDataSamples: { sampleData: string[]; categories: string[]; contentTypes: string[] }
): string[] {
  const agentCategory = (agentConfig.category as string || '').toLowerCase();
  const agentDescription = (agentConfig.description as string || '').toLowerCase();

  // Special handling for financial agents
  if (agentCategory.includes('data analysis') && 
      (agentDescription.includes('financial') || agentDescription.includes('finance'))) {
    
    if (!userDataSamples.sampleData.length) {
      // No data yet - focus on financial setup
      return [
        "What types of financial data should I upload for you to analyze?",
        "Can you explain how you can help me track and analyze my financial activities?",
        "What financial insights can you provide once I share my data with you?"
      ];
    }

    // Has some financial data
    return [
      "Can you analyze my spending patterns and identify areas for potential savings?",
      "What trends do you notice in my income and expenses over time?",
      "Based on my financial data, what recommendations do you have for improving my financial health?"
    ];
  }

  // Default fallback for non-financial agents
  if (!userDataSamples.sampleData.length) {
    return [
      `How can you help me get started with ${agentCategory}?`,
      `What types of data would be most valuable for you to analyze?`,
      `What are your main capabilities in ${agentDescription}?`
    ];
  }

  const dataTypes = userDataSamples.categories.length > 0 
    ? userDataSamples.categories.join(' and ')
    : 'available data';

  return [
    `Can you analyze my recent ${dataTypes} and provide insights?`,
    `What patterns or trends do you notice in my ${dataTypes}?`,
    `Based on my ${dataTypes}, what recommendations do you have for improvement?`
  ];
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestStartTime = Date.now();
  const session = await auth();
  const userId = session?.userId;
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agentId } = await context.params;
    console.log('✅ Agent config retrieved:', agentId);

    // Get agent configuration
    const agentConfig = await getAgentConfig(agentId);
    
    // Fetch user data samples
    console.log('📊 Fetching user data samples...');
    const userDataSamples = await fetchUserDataSamples(
      agentConfig.selectedContextIds || [],
      userId,
      requestStartTime
    );
    
    console.log('📊 Data samples retrieved:', {
      sampleCount: userDataSamples.sampleData.length,
      categoriesCount: userDataSamples.categories.length,
      contentTypesCount: userDataSamples.contentTypes.length
    });

    // Initialize the model
    const model = await initializeGeminiModel({
      maxOutputTokens: 1024,
      temperature: 0.7
    });
    
    // Create and format the prompt
    const prompt = new PromptTemplate({
      template: DATA_DRIVEN_QUESTION_TEMPLATE,
      inputVariables: [
        "agentName",
        "agentDescription",
        "agentCategory",
        "selectedContextIds",
        "actualDataSamples",
        "userCategories",
        "userContentTypes"
      ],
    });

    // Maximum retries for LLM generation
    const MAX_RETRIES = 3;
    let attempt = 0;
    let questions: string[] = [];
    let usedFallback = false;

    while (attempt < MAX_RETRIES) {
      attempt++;
      console.log(`🤖 Attempting LLM generation... (Attempt ${attempt}/${MAX_RETRIES})`);

      try {
        const chain = prompt
          .pipe(model)
          .pipe(new StringOutputParser());

        const response = await withTimeout(
          chain.invoke({
            agentName: agentConfig.name || "AI Fitness Coach",
            agentDescription: agentConfig.description || "Fitness analysis and recommendations",
            agentCategory: agentConfig.category || "fitness",
            selectedContextIds: agentConfig.selectedContextIds?.join(", ") || "",
            actualDataSamples: userDataSamples.sampleData.join("\n\n"),
            userCategories: userDataSamples.categories.join(", "),
            userContentTypes: userDataSamples.contentTypes.join(", ")
          }),
          NETLIFY_TIMEOUT_MS - (Date.now() - requestStartTime),
          ""
        );

        if (response.trim() === "NOT_ENOUGH_DATA") {
          return NextResponse.json({
            success: false,
            error: "insufficient_data",
            message: "Not enough activity data available. Please log some activities first to get personalized insights."
          });
        }

        // Parse the numbered list response
        questions = response
          .split("\n")
          .filter(line => line.trim().match(/^\d+\./))
          .map(line => line.replace(/^\d+\.\s*/, "").trim());

        if (questions.length > 0) {
          break; // Success! Exit the retry loop
        }

        console.log("⚠️ No valid questions generated, retrying...");
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      } catch (error) {
        console.error(`⚠️ LLM generation attempt ${attempt} failed:`, error);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    // If all attempts failed, use fallback questions
    if (questions.length === 0) {
      console.log("❌ All LLM generation attempts failed, using smart fallback");
      questions = generateDataDrivenFallbackQuestions(agentConfig, userDataSamples);
      usedFallback = true;
    }

    return NextResponse.json({
      success: true,
      questions,
      agentId,
      agentName: agentConfig.name,
      fallback: usedFallback,
      attempts: attempt,
      timeElapsed: Date.now() - requestStartTime,
      dataInfo: {
        sampleDataCount: userDataSamples.sampleData.length,
        categories: userDataSamples.categories,
        contentTypes: userDataSamples.contentTypes
      }
    });
  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to generate questions",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 