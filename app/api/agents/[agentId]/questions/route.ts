import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Increase timeout for Netlify - max execution time tracking
const NETLIFY_TIMEOUT_MS = 30000; // 30 seconds

// Helper function to check if we're running out of time
function isTimeoutApproaching(requestStartTime: number): boolean {
  const elapsed = Date.now() - requestStartTime;
  return elapsed > (NETLIFY_TIMEOUT_MS - 2000); // Leave 2 seconds buffer
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
const DATA_DRIVEN_QUESTION_TEMPLATE = `You are a helpful assistant that generates 3 specific, data-driven example questions for an AI agent based on the user's actual data content.

Agent: {agentName}
Description: {agentDescription}
Category: {agentCategory}
Data Access: {selectedContextIds}

ACTUAL USER DATA SAMPLES:
{actualDataSamples}

USER'S DATA CATEGORIES:
{userCategories}

USER'S CONTENT TYPES:
{userContentTypes}

Generate 3 questions that:
1. Reference specific content, patterns, or insights from the actual user data samples above
2. Are relevant to the agent's purpose and the user's actual data
3. Would require analysis of the user's real data to answer
4. Vary in type: analytical (patterns/trends), actionable (recommendations), and exploratory (connections/insights)

Make the questions specific to what you can see in their actual data. For example:
- If you see fitness data, ask about specific activities or patterns you observe
- If you see work data, ask about projects, productivity patterns, or collaboration insights
- If you see learning data, ask about study methods, comprehension patterns, or subject performance

Return as JSON:
{{
  "questions": [
    "Analytical question based on patterns in the actual data samples...",
    "Actionable question for recommendations based on real user content...",
    "Exploratory question about connections and insights from their data..."
  ]
}}`;

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
  if (isTimeoutApproaching(requestStartTime)) {
    return { sampleData: [], categories: [], contentTypes: [] };
  }

  try {
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Create a query to get diverse samples from user's data
    const queryEmbedding = await embeddings.embedQuery("data content sample");
    
    // Query for user's data across their selected contexts
    const response = await withTimeout(
      index.query({
        vector: queryEmbedding,
        filter: {
          $and: [
            { userId },
            {
              $or: [
                { category: { $in: selectedContextIds } },
                { type: { $in: selectedContextIds } },
                { id: { $in: selectedContextIds.map(id => `${userId}_${id}`) } }
              ]
            }
          ]
        },
        topK: 15, // Get diverse samples
        includeMetadata: true,
        includeValues: false
      }),
      10000, // 10 second timeout
      null
    );

    if (!response || !response.matches?.length) {
      return { sampleData: [], categories: [], contentTypes: [] };
    }

    // Extract actual data content, categories, and types
    const sampleData: string[] = [];
    const categories = new Set<string>();
    const contentTypes = new Set<string>();

    response.matches.forEach(match => {
      const metadata = match.metadata;
      if (!metadata) return;

      // Extract content sample
      if (metadata.text || metadata.content) {
        const content = String(metadata.text || metadata.content);
        if (content.length > 20) { // Only meaningful content
          sampleData.push(content.substring(0, 200)); // First 200 chars
        }
      }

      // Extract categories
      if (metadata.category) {
        categories.add(String(metadata.category));
      }
      if (metadata.categories && Array.isArray(metadata.categories)) {
        metadata.categories.forEach(cat => categories.add(String(cat)));
      }

      // Extract content types
      if (metadata.type) {
        contentTypes.add(String(metadata.type));
      }
      if (metadata.documentType) {
        contentTypes.add(String(metadata.documentType));
      }
    });

    return {
      sampleData: sampleData.slice(0, 10), // Limit to 10 samples
      categories: Array.from(categories).slice(0, 5),
      contentTypes: Array.from(contentTypes).slice(0, 5)
    };
  } catch (error) {
    console.log('⚠️ Error fetching user data samples:', error);
    return { sampleData: [], categories: [], contentTypes: [] };
  }
}

// Data-driven fallback question generation using actual user content
function generateDataDrivenFallbackQuestions(
  agentConfig: Record<string, unknown>, 
  userDataSamples: { sampleData: string[]; categories: string[]; contentTypes: string[] }
): string[] {
  const category = (agentConfig.category as string)?.toLowerCase() || '';
  const contextIds = (agentConfig.selectedContextIds as string[]) || [];
  const { sampleData, categories, contentTypes } = userDataSamples;
  
  // If we have actual user data, use it to generate specific questions
  if (sampleData.length > 0 || categories.length > 0) {
    const dataMention = categories.length > 0 ? categories.join(' and ') : 'your data';
    const typeMention = contentTypes.length > 0 ? contentTypes.join(' and ') : 'content';
    
    return [
      `What patterns and insights can you identify in my ${dataMention} based on the content you have access to?`,
      `How can you help me optimize my activities based on the ${typeMention} in my knowledge base?`,
      `What connections and trends do you see across my ${dataMention} and how can I use these insights?`
    ];
  }
  
  // Fallback to category-based questions if no user data
  if (category.includes('physical') || category.includes('fitness')) {
    return [
      `What patterns can you identify in my activity data?`,
      `How can you help optimize my physical performance based on available metrics?`,
      `What correlations exist between my performance and other factors?`
    ];
  }
  
  if (category.includes('work') || category.includes('productivity')) {
    return [
      `What insights can you provide about my work productivity patterns?`,
      `How can you help improve my focus and task completion?`,
      `What trends do you see in my professional data?`
    ];
  }
  
  if (category.includes('learning') || category.includes('study')) {
    return [
      `What learning patterns can you identify in my study data?`,
      `How can you help optimize my study sessions based on available data?`,
      `What subjects or topics show the best learning outcomes?`
    ];
  }
  
  // Generic fallback
  return [
    `What patterns and insights can you identify in my ${contextIds.join(' and ') || 'available'} data?`,
    `How can you help me optimize my activities based on the information you have access to?`,
    `What connections and trends do you see across my ${category || 'personal'} information?`
  ];
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const startTime = Date.now(); // Set start time per request
  
  try {
    const { agentId } = await context.params;
    
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('🚀 Starting optimized question generation for agent:', agentId);
    console.log('⏱️ Timeout buffer: 30 seconds');

    // Quick agent config retrieval
    const agentConfig = await withTimeout(
      getAgentConfig(agentId),
      30000, // 30 second timeout
      null
    );
    
    if (!agentConfig) {
      return NextResponse.json(
        { error: "Agent not found or request timed out" },
        { status: 404 }
      );
    }

    console.log('✅ Agent config retrieved:', agentConfig.name);

    // Fetch actual user data samples for question generation
    console.log('📊 Fetching user data samples...');
    const userDataSamples = await fetchUserDataSamples(agentConfig.selectedContextIds || [], userId, startTime);
    console.log('📊 Data samples retrieved:', {
      sampleCount: userDataSamples.sampleData.length,
      categoriesCount: userDataSamples.categories.length,
      contentTypesCount: userDataSamples.contentTypes.length
    });

    // Check if we need to use fast fallback due to time constraints
    if (isTimeoutApproaching(startTime)) {
      console.log('⚡ Using fast fallback due to time constraints');
      const fallbackQuestions = generateDataDrivenFallbackQuestions(agentConfig, userDataSamples);
      
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions,
        agentId,
        agentName: agentConfig.name,
        fallback: true,
        fastMode: true,
        timeElapsed: Date.now() - startTime,
        dataInfo: {
          sampleDataCount: userDataSamples.sampleData.length,
          categories: userDataSamples.categories,
          contentTypes: userDataSamples.contentTypes
        }
      });
    }

    // Try LLM generation with timeout
    try {
      console.log('🤖 Attempting LLM generation...');
      
      const questionModel = await withTimeout(
        initializeGeminiModel({
          maxOutputTokens: 512, // Reduced for faster generation
          temperature: 0.7, // Balanced creativity/speed
        }),
        30000, // 30 second timeout for model init
        null
      );

      if (!questionModel) {
        throw new Error('Model initialization timed out');
      }

      const prompt = PromptTemplate.fromTemplate(DATA_DRIVEN_QUESTION_TEMPLATE);
      const chain = prompt.pipe(questionModel).pipe(new StringOutputParser());

      const sampleFields = userDataSamples.categories.slice(0, 3).join(', ') || 'general content';

      const response = await withTimeout(
        chain.invoke({
          agentName: agentConfig.name || "AI Assistant",
          agentDescription: agentConfig.description || "A helpful AI assistant",
          agentCategory: agentConfig.category || "General",
          selectedContextIds: agentConfig.selectedContextIds?.join(', ') || 'general data',
          actualDataSamples: userDataSamples.sampleData.join('\n'),
          userCategories: userDataSamples.categories.join('\n'),
          userContentTypes: userDataSamples.contentTypes.join('\n'),
          sampleFields
        }),
        30000, // 30 second timeout for generation
        null
      );

      if (!response) {
        throw new Error('LLM generation timed out');
      }

      console.log('🔍 Raw LLM response:', response);

      // Quick JSON parsing
      const jsonMatch = response.trim().match(/\{[\s\S]*\}/);
      console.log('🔍 JSON match found:', !!jsonMatch);
      
      if (jsonMatch) {
        console.log('🔍 Matched JSON:', jsonMatch[0]);
        try {
          const questionsData = JSON.parse(jsonMatch[0]);
          console.log('🔍 Parsed data:', questionsData);
          
          if (questionsData.questions && Array.isArray(questionsData.questions)) {
            const validQuestions = questionsData.questions
              .filter((q: string) => q && typeof q === 'string' && q.trim().length > 0)
              .slice(0, 3);

            console.log('🔍 Valid questions found:', validQuestions.length, validQuestions);

            if (validQuestions.length > 0) {
              console.log('✅ LLM generation successful');
              return NextResponse.json({
                success: true,
                questions: validQuestions,
                agentId,
                agentName: agentConfig.name,
                fallback: false,
                timeElapsed: Date.now() - startTime,
                dataInfo: {
                  sampleDataCount: userDataSamples.sampleData.length,
                  categories: userDataSamples.categories,
                  contentTypes: userDataSamples.contentTypes
                }
              });
            }
          } else {
            console.log('❌ Questions field missing or not array:', questionsData);
          }
        } catch (parseError) {
          console.log('❌ JSON parse error:', parseError);
        }
      } else {
        console.log('❌ No JSON found in response');
      }

      throw new Error('Invalid LLM response format');

    } catch (llmError) {
      console.warn('⚠️ LLM generation failed, using smart fallback:', llmError);
      
      // Smart fallback with category-aware questions
      const fallbackQuestions = generateDataDrivenFallbackQuestions(agentConfig, userDataSamples);
      
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions,
        agentId,
        agentName: agentConfig.name,
        fallback: true,
        reason: 'LLM generation failed',
        timeElapsed: Date.now() - startTime,
        dataInfo: {
          sampleDataCount: userDataSamples.sampleData.length,
          categories: userDataSamples.categories,
          contentTypes: userDataSamples.contentTypes
        }
      });
    }

  } catch (error) {
    console.error("❌ Critical error in question generation:", error);
    
    // Final emergency fallback
    return NextResponse.json({
      success: true,
      questions: [
        "What insights can you provide based on your available data?",
        "How can you help me understand patterns in my information?",
        "What would you recommend I upload for better analysis?"
      ],
      agentId: (await context.params).agentId,
      fallback: true,
      emergency: true,
      error: error instanceof Error ? error.message : "Unknown error",
      timeElapsed: Date.now() - startTime
    });
  }
} 