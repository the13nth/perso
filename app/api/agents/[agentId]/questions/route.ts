import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Increase timeout for Netlify - max execution time tracking
const NETLIFY_TIMEOUT_MS = 25000; // 25 seconds, giving 1 second buffer
const startTime = Date.now();

// Helper function to check if we're running out of time
function isTimeoutApproaching(): boolean {
  const elapsed = Date.now() - startTime;
  return elapsed > (NETLIFY_TIMEOUT_MS - 3000); // Leave 3 seconds buffer
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

// Category to data fields mapping based on the application's data structure
const CATEGORY_FIELD_MAPPINGS: Record<string, {
  fields: string[];
  description: string;
  sampleQuestions: string[];
}> = {
  'physical': {
    fields: ['activity', 'distance', 'duration', 'intensity', 'feeling', 'productivity', 'goalSet', 'goalAchieved', 'location', 'activityDate'],
    description: 'Physical activities and exercise data with metrics like distance, intensity, and personal feelings',
    sampleQuestions: [
      'What correlations exist between my intensity levels and how I felt during workouts?',
      'Based on my distance and duration data, what pace improvements can you identify over time?',
      'How does my goal achievement rate vary across different activity types and locations?'
    ]
  },
  'running': {
    fields: ['distance', 'duration', 'pace', 'feeling', 'intensity', 'goalAchieved', 'location', 'weather', 'route'],
    description: 'Running-specific data with detailed metrics and environmental factors',
    sampleQuestions: [
      'What\'s the correlation between my pace and how I felt during runs over the past month?',
      'Based on my running history, what distance and pace should I target for my next race?',
      'Which days of the week show my best running performance, and what patterns can you identify?'
    ]
  },
  'work': {
    fields: ['activity', 'projectName', 'duration', 'productivity', 'focusLevel', 'collaborators', 'workTools', 'tasksCompleted', 'feeling', 'goalAchieved'],
    description: 'Work activities and professional task data with productivity and collaboration metrics',
    sampleQuestions: [
      'How does my focus level correlate with productivity across different projects?',
      'Which time periods show peak productivity, and what work tools were most effective?',
      'What project types require more collaboration, and how does this affect task completion rates?'
    ]
  },
  'study': {
    fields: ['activity', 'subject', 'duration', 'studyMaterial', 'comprehensionLevel', 'notesCreated', 'productivity', 'feeling', 'goalAchieved'],
    description: 'Learning and study session data with comprehension and material tracking',
    sampleQuestions: [
      'What study methods have been most effective based on my comprehension level data?',
      'How does study duration correlate with my comprehension across different subjects?',
      'Which subjects show the best learning outcomes, and what study materials were most helpful?'
    ]
  },
  'routine': {
    fields: ['activity', 'routineSteps', 'duration', 'consistency', 'moodBefore', 'moodAfter', 'feeling', 'productivity', 'goalAchieved'],
    description: 'Daily routines and habits with mood and consistency tracking',
    sampleQuestions: [
      'How does routine consistency affect my mood changes throughout different activities?',
      'What routine steps correlate with the biggest positive mood shifts?',
      'Based on my routine data, what time of day am I most consistent with habit formation?'
    ]
  },
  'notes': {
    fields: ['title', 'content', 'category', 'tags', 'createdAt', 'sentiment', 'topics', 'connections'],
    description: 'Personal notes and thoughts with categorization and topic analysis',
    sampleQuestions: [
      'What themes and patterns can you identify across my personal notes and thoughts?',
      'Based on my note-taking history, what topics do I return to most frequently?',
      'How can you help me organize and connect related ideas from my knowledge base?'
    ]
  },
  'learning': {
    fields: ['topic', 'duration', 'method', 'comprehension', 'retention', 'difficulty', 'resources', 'notes', 'progress'],
    description: 'Learning activities with comprehension and retention tracking',
    sampleQuestions: [
      'What learning methods show the highest comprehension rates across different topics?',
      'How does study duration correlate with retention for various difficulty levels?',
      'Which learning resources have been most effective for different types of content?'
    ]
  },
  'professional': {
    fields: ['taskType', 'duration', 'complexity', 'outcome', 'collaboration', 'tools', 'efficiency', 'satisfaction'],
    description: 'Professional work tasks with efficiency and satisfaction metrics',
    sampleQuestions: [
      'What task types show the highest efficiency rates, and what tools were used?',
      'How does collaboration level affect task outcomes and personal satisfaction?',
      'What patterns exist between task complexity and the time required for completion?'
    ]
  },
  'general': {
    fields: ['content', 'category', 'type', 'timestamp', 'relevance', 'importance', 'context'],
    description: 'General content and information with contextual metadata',
    sampleQuestions: [
      'What content categories appear most frequently in your data?',
      'Based on timestamp analysis, what patterns exist in your information consumption?',
      'How can I help you find connections between different types of content in your knowledge base?'
    ]
  }
};

// Optimized single-step question generation template
const OPTIMIZED_QUESTION_TEMPLATE = `You are a helpful assistant that generates 3 specific, data-driven example questions for an AI agent.

Agent: {agentName}
Description: {agentDescription}
Category: {agentCategory}
Data Access: {selectedContextIds}

Available Data Fields: {availableFields}

Generate 3 questions that:
1. Reference specific field names from the available data
2. Are relevant to the agent's purpose and category
3. Would require the agent's actual data to answer properly
4. Vary in type: analytical, task-oriented, and insight-focused

Return as JSON:
{{
  "questions": [
    "Question using specific field names like {sampleFields}...",
    "Question for actionable insights from the data fields...",
    "Question for optimization based on data relationships..."
  ]
}}`;

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

// Fast field analysis without complex processing
function getRelevantFields(selectedContextIds: string[]): {
  fields: string[];
} {
  if (isTimeoutApproaching()) {
    return { fields: ['activity', 'date', 'content'] };
  }

  const allFields = new Set<string>();
  
  selectedContextIds.forEach(contextId => {
    const normalizedId = contextId.toLowerCase().trim();
    
    // Direct mapping check
    if (CATEGORY_FIELD_MAPPINGS[normalizedId]) {
      const mapping = CATEGORY_FIELD_MAPPINGS[normalizedId];
      mapping.fields.forEach(field => allFields.add(field));
    } else {
      // Quick partial match for the most common categories
      const quickMatches = ['physical', 'work', 'study', 'notes', 'routine'];
      const matched = quickMatches.find(cat => 
        normalizedId.includes(cat) || cat.includes(normalizedId)
      );
      
      if (matched && CATEGORY_FIELD_MAPPINGS[matched]) {
        const mapping = CATEGORY_FIELD_MAPPINGS[matched];
        mapping.fields.forEach(field => allFields.add(field));
      }
    }
  });
  
  // Fallback to general if no matches
  if (allFields.size === 0) {
    CATEGORY_FIELD_MAPPINGS['general'].fields.forEach(field => allFields.add(field));
  }
  
  return {
    fields: Array.from(allFields)
  };
}

// Fast fallback question generation
function generateFastFallbackQuestions(agentConfig: Record<string, unknown>, fields: string[]): string[] {
  const category = (agentConfig.category as string)?.toLowerCase() || '';
  const contextIds = (agentConfig.selectedContextIds as string[]) || [];
  
  // Quick category-based question generation
  if (category.includes('physical') || category.includes('fitness')) {
    return [
      `What patterns can you identify in my ${fields.includes('activity') ? 'activity' : 'fitness'} data?`,
      `How can you help optimize my physical performance based on ${fields.includes('intensity') ? 'intensity and feeling' : 'available'} metrics?`,
      `What correlations exist between my ${fields.includes('goalAchieved') ? 'goal achievement' : 'performance'} and other factors?`
    ];
  }
  
  if (category.includes('work') || category.includes('productivity')) {
    return [
      `What insights can you provide about my work ${fields.includes('productivity') ? 'productivity patterns' : 'activities'}?`,
      `How can you help improve my ${fields.includes('focusLevel') ? 'focus and task completion' : 'work efficiency'}?`,
      `What trends do you see in my ${fields.includes('projectName') ? 'project work' : 'professional'} data?`
    ];
  }
  
  if (category.includes('learning') || category.includes('study')) {
    return [
      `What learning patterns can you identify in my ${fields.includes('comprehension') ? 'comprehension' : 'study'} data?`,
      `How can you help optimize my study sessions based on ${fields.includes('studyMaterial') ? 'materials and methods' : 'available'} data?`,
      `What subjects or topics show the best ${fields.includes('retention') ? 'retention rates' : 'learning outcomes'}?`
    ];
  }
  
  // Generic fallback
  return [
    `What patterns and insights can you identify in my ${contextIds.join(' and ') || 'available'} data?`,
    `How can you help me optimize my activities based on the ${fields.length} data fields you have access to?`,
    `What connections and trends do you see across my ${category || 'personal'} information?`
  ];
}

export async function GET(_request: NextRequest, context: RouteContext) {
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
    console.log('⏱️ Timeout buffer: 25 seconds');

    // Quick agent config retrieval
    const agentConfig = await withTimeout(
      getAgentConfig(agentId),
      5000, // 5 second timeout
      null
    );
    
    if (!agentConfig) {
      return NextResponse.json(
        { error: "Agent not found or request timed out" },
        { status: 404 }
      );
    }

    console.log('✅ Agent config retrieved:', agentConfig.name);

    // Fast field analysis
    const { fields } = getRelevantFields(agentConfig.selectedContextIds || []);
    console.log('📊 Field analysis completed:', fields.length, 'fields identified');

    // Check if we need to use fast fallback due to time constraints
    if (isTimeoutApproaching()) {
      console.log('⚡ Using fast fallback due to time constraints');
      const fallbackQuestions = generateFastFallbackQuestions(agentConfig, fields);
      
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions,
        agentId,
        agentName: agentConfig.name,
        fallback: true,
        fastMode: true,
        timeElapsed: Date.now() - startTime,
        fieldInfo: {
          availableFields: fields.slice(0, 10),
          totalFieldCount: fields.length,
          categoriesAnalyzed: agentConfig.selectedContextIds || []
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
        8000, // 8 second timeout for model init
        null
      );

      if (!questionModel) {
        throw new Error('Model initialization timed out');
      }

      const prompt = PromptTemplate.fromTemplate(OPTIMIZED_QUESTION_TEMPLATE);
      const chain = prompt.pipe(questionModel).pipe(new StringOutputParser());

      const sampleFields = fields.slice(0, 3).join(', ') || 'activity, date, content';

      const response = await withTimeout(
        chain.invoke({
          agentName: agentConfig.name || "AI Assistant",
          agentDescription: agentConfig.description || "A helpful AI assistant",
          agentCategory: agentConfig.category || "General",
          selectedContextIds: agentConfig.selectedContextIds?.join(', ') || 'general data',
          availableFields: fields.slice(0, 15).join(', '), // Limit for performance
          sampleFields
        }),
        10000, // 10 second timeout for generation
        null
      );

      if (!response) {
        throw new Error('LLM generation timed out');
      }

      // Quick JSON parsing
      const jsonMatch = response.trim().match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const questionsData = JSON.parse(jsonMatch[0]);
        if (questionsData.questions && Array.isArray(questionsData.questions)) {
          const validQuestions = questionsData.questions
            .filter((q: string) => q && typeof q === 'string' && q.trim().length > 0)
            .slice(0, 3);

          if (validQuestions.length > 0) {
            console.log('✅ LLM generation successful');
            return NextResponse.json({
              success: true,
              questions: validQuestions,
              agentId,
              agentName: agentConfig.name,
              fallback: false,
              timeElapsed: Date.now() - startTime,
              fieldInfo: {
                availableFields: fields.slice(0, 15),
                totalFieldCount: fields.length,
                categoriesAnalyzed: agentConfig.selectedContextIds || []
              }
            });
          }
        }
      }

      throw new Error('Invalid LLM response format');

    } catch (llmError) {
      console.warn('⚠️ LLM generation failed, using smart fallback:', llmError);
      
      // Smart fallback with category-aware questions
      const fallbackQuestions = generateFastFallbackQuestions(agentConfig, fields);
      
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions,
        agentId,
        agentName: agentConfig.name,
        fallback: true,
        reason: 'LLM generation failed',
        timeElapsed: Date.now() - startTime,
        fieldInfo: {
          availableFields: fields.slice(0, 15),
          totalFieldCount: fields.length,
          categoriesAnalyzed: agentConfig.selectedContextIds || []
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