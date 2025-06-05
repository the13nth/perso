import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig, getAgentContext } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

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

const CATEGORY_CLARIFICATION_TEMPLATE = `You are an AI assistant specialized in understanding and clarifying data context categories for intelligent agents.

Agent Information:
- Name: {agentName}
- Description: {agentDescription}
- Category: {agentCategory}
- Use Cases: {agentUseCases}

Selected Context Categories: {selectedContextIds}

Available Category Mappings:
{categoryMappings}

Sample Context Data (if available):
{contextSamples}

Your task is to analyze and clarify what these context categories mean for this specific agent, considering:

1. **Category Interpretation**: What do these category names likely represent in the context of this agent's purpose?
2. **Data Field Relevance**: Which data fields from the category mappings are most relevant to this agent's use case?
3. **Cross-Category Connections**: How might these different categories work together for this agent?
4. **Agent-Specific Context**: How do these categories align with the agent's description and use cases?
5. **Data Structure Understanding**: What kind of questions would be most valuable given this agent's data access?
6. **Context Completeness**: Based on the agent's purpose, what additional context categories or data types would significantly improve its capabilities?

Provide a comprehensive analysis that explains:
- What each category likely contains for this agent
- Which data fields are most important
- How the categories complement each other
- What unique insights this agent can provide
- **Context Enhancement Recommendations**: What additional context categories, data fields, or information types should be added to improve this agent's effectiveness

Format your response as a structured analysis that will help generate highly relevant questions and identify missing context opportunities.`;

const QUESTION_GENERATION_TEMPLATE = `You are a helpful assistant that generates relevant example questions for AI agents based on their clarified data access and field schemas.

Agent Information:
- Name: {agentName}
- Description: {agentDescription}
- Category: {agentCategory}
- Use Cases: {agentUseCases}

Clarified Category Analysis:
{clarifiedAnalysis}

Data Categories and Fields Available:
{categoryFieldInfo}

Context Analysis:
{contextAnalysis}

Context Enhancement Opportunities:
{contextRecommendations}

Guidelines for generating questions:
1. Use the clarified category analysis to understand what data is actually meaningful for this agent
2. Make questions highly specific to the agent's ACTUAL DATA FIELDS and clarified understanding
3. Reference specific field names and metrics the agent has access to
4. Questions should leverage the agent's real data capabilities and clarified context
5. Vary the question types:
   - One analytical question (asking for trends, patterns, correlations in their clarified data)
   - One task-oriented question (asking for specific actions based on their clarified field data)
   - One optimization/insight question (asking for recommendations using their clarified data schema)
6. Use the exact field names provided in the category mappings
7. Keep questions engaging and conversational (15-60 words each)
8. Ensure questions would require the agent's specific clarified data access to answer properly
9. Avoid generic questions - make them data-field-driven and specific to the clarified context
10. If multiple categories exist, reference fields from different categories based on the clarified analysis
11. If context is limited, acknowledge limitations and suggest what additional data would improve responses

Examples based on clarified understanding:
- If clarified analysis shows physical data focuses on performance tracking: "What's the correlation between my intensity levels and feeling ratings across different distances and training locations?"
- If clarified analysis shows work data emphasizes productivity optimization: "Based on my clarified work context, how does focus level vary across different projects, and which collaboration patterns show highest productivity?"
- If clarified analysis shows study data is about learning effectiveness: "Which study materials and comprehension methods correlate with highest learning outcomes across different subjects in my clarified learning context?"
- If context is limited: "Based on available data, what initial insights can you provide, and what additional context should I upload for deeper analysis?"

Return the questions in this exact JSON format:
{{
  "questions": [
    "First clarified-context question using exact field names from the schemas...",
    "Second actionable question based on clarified field understanding...",
    "Third optimization question leveraging clarified data relationships..."
  ]
}}

Generate the JSON now:`;

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

// Helper function to analyze agent's categories and map to expected fields
function analyzeCategoryFields(selectedContextIds: string[]): {
  categoryInfo: string;
  availableFields: string[];
  contextAnalysis: string;
} {
  const relevantCategories: Array<{
    category: string;
    mapping: typeof CATEGORY_FIELD_MAPPINGS[string];
  }> = [];
  
  const allFields = new Set<string>();
  
  // Find matching categories (case-insensitive partial matching)
  selectedContextIds.forEach(contextId => {
    const normalizedContextId = contextId.toLowerCase().trim();
    
    // Direct matches
    if (CATEGORY_FIELD_MAPPINGS[normalizedContextId]) {
      relevantCategories.push({
        category: normalizedContextId,
        mapping: CATEGORY_FIELD_MAPPINGS[normalizedContextId]
      });
      CATEGORY_FIELD_MAPPINGS[normalizedContextId].fields.forEach(field => allFields.add(field));
    } else {
      // Partial matches
      Object.keys(CATEGORY_FIELD_MAPPINGS).forEach(categoryKey => {
        if (normalizedContextId.includes(categoryKey) || categoryKey.includes(normalizedContextId)) {
          relevantCategories.push({
            category: categoryKey,
            mapping: CATEGORY_FIELD_MAPPINGS[categoryKey]
          });
          CATEGORY_FIELD_MAPPINGS[categoryKey].fields.forEach(field => allFields.add(field));
        }
      });
    }
  });
  
  // If no matches found, use general category
  if (relevantCategories.length === 0) {
    relevantCategories.push({
      category: 'general',
      mapping: CATEGORY_FIELD_MAPPINGS['general']
    });
    CATEGORY_FIELD_MAPPINGS['general'].fields.forEach(field => allFields.add(field));
  }
  
  // Build category information string
  const categoryInfo = relevantCategories.map(({ category, mapping }) => 
    `Category: ${category}
Description: ${mapping.description}
Available Fields: [${mapping.fields.join(', ')}]
Sample Questions for this category:
${mapping.sampleQuestions.map(q => `- ${q}`).join('\n')}
`
  ).join('\n');
  
  // Build context analysis
  const uniqueCategories = Array.from(new Set(relevantCategories.map(r => r.category)));
  const contextAnalysis = `
Selected Context IDs: ${selectedContextIds.join(', ')}
Matched Categories: ${uniqueCategories.join(', ')}
Total Available Fields: ${allFields.size}
Cross-Category Analysis Possible: ${uniqueCategories.length > 1 ? 'Yes' : 'No'}
Field Overlap Analysis: ${uniqueCategories.length > 1 ? 'Questions can reference multiple category fields for comprehensive insights' : 'Questions focused on single category optimization'}
`;

  return {
    categoryInfo,
    availableFields: Array.from(allFields),
    contextAnalysis
  };
}

// Helper function to build category mappings string for clarification
function buildCategoryMappingsString(): string {
  return Object.entries(CATEGORY_FIELD_MAPPINGS).map(([category, mapping]) => 
    `${category}: ${mapping.description} [Fields: ${mapping.fields.join(', ')}]`
  ).join('\n');
}

// Helper function to analyze context completeness and generate recommendations
function generateContextRecommendations(
  agentConfig: any, 
  availableFields: string[], 
  selectedContextIds: string[]
): string {
  const agentCategory = agentConfig.category?.toLowerCase() || '';
  
  const recommendations: string[] = [];
  
  // Analyze what's missing based on agent type
  if (agentCategory.includes('fitness') || agentCategory.includes('health') || agentCategory.includes('physical')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('physical'))) {
      recommendations.push("• Physical activity data (running, workouts, sports) with metrics like distance, duration, intensity, and personal feelings");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('nutrition'))) {
      recommendations.push("• Nutrition and diet tracking data to correlate with physical performance");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('sleep'))) {
      recommendations.push("• Sleep pattern data to understand recovery and performance relationships");
    }
  }
  
  if (agentCategory.includes('work') || agentCategory.includes('productivity') || agentCategory.includes('professional')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('work'))) {
      recommendations.push("• Work activity logs with project names, task completion, productivity levels, and collaboration details");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('calendar'))) {
      recommendations.push("• Calendar and meeting data to analyze time management patterns");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('communication'))) {
      recommendations.push("• Communication logs (emails, messages) to understand collaboration patterns");
    }
  }
  
  if (agentCategory.includes('learning') || agentCategory.includes('education') || agentCategory.includes('study')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('study'))) {
      recommendations.push("• Study session logs with subjects, materials, comprehension levels, and learning outcomes");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('notes'))) {
      recommendations.push("• Learning notes and knowledge base content for topic analysis and connections");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('progress'))) {
      recommendations.push("• Progress tracking data across different subjects and learning goals");
    }
  }
  
  if (agentCategory.includes('personal') || agentCategory.includes('lifestyle')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('routine'))) {
      recommendations.push("• Daily routine and habit tracking with mood and consistency metrics");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('notes'))) {
      recommendations.push("• Personal notes, thoughts, and reflections for pattern analysis");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('goals'))) {
      recommendations.push("• Goal setting and achievement tracking across different life areas");
    }
  }
  
  // Business/Customer Service specific recommendations
  if (agentCategory.includes('customer') || agentCategory.includes('business') || agentCategory.includes('service')) {
    if (!selectedContextIds.some(id => id.toLowerCase().includes('support'))) {
      recommendations.push("• Customer support interactions and ticket resolution data");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('feedback'))) {
      recommendations.push("• Customer feedback and satisfaction survey responses");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('product'))) {
      recommendations.push("• Product usage analytics and feature adoption metrics");
    }
  }
  
  // Data Analysis specific recommendations
  if (agentCategory.includes('data') || agentCategory.includes('analysis') || agentCategory.includes('insight')) {
    if (availableFields.length < 5) {
      recommendations.push("• More structured data with consistent field schemas for better pattern recognition");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('metrics'))) {
      recommendations.push("• Performance metrics and KPI tracking data with timestamps");
    }
    if (!selectedContextIds.some(id => id.toLowerCase().includes('trends'))) {
      recommendations.push("• Historical trend data to enable time-series analysis and forecasting");
    }
  }
  
  // Generic recommendations based on current limitations
  if (availableFields.length < 3) {
    recommendations.push("• More detailed structured data with specific fields and metrics for each activity or event");
  }
  
  if (selectedContextIds.length < 2) {
    recommendations.push("• Additional complementary data categories to enable cross-category insights and correlations");
  }
  
  // Check for specific missing field types that would enhance analysis
  const hasTemporalData = availableFields.some(f => f.includes('date') || f.includes('time') || f.includes('timestamp'));
  if (!hasTemporalData) {
    recommendations.push("• Timestamp/date information to enable temporal analysis and trend identification");
  }
  
  const hasQuantitativeData = availableFields.some(f => ['distance', 'duration', 'score', 'rating', 'count'].some(q => f.includes(q)));
  if (!hasQuantitativeData) {
    recommendations.push("• Quantitative metrics (numbers, ratings, scores) for statistical analysis and correlation studies");
  }
  
  const hasQualitativeData = availableFields.some(f => ['feeling', 'mood', 'notes', 'description', 'content'].some(q => f.includes(q)));
  if (!hasQualitativeData) {
    recommendations.push("• Qualitative descriptions (feelings, notes, observations) for context and sentiment analysis");
  }
  
  if (recommendations.length === 0) {
    recommendations.push("• Your current context appears comprehensive for the agent's purpose");
    recommendations.push("• Consider adding timestamped data for trend analysis over time");
    recommendations.push("• Cross-referenced data from related activities could provide additional insights");
  }
  
  return `Context Enhancement Recommendations:
${recommendations.join('\n')}

These additions would enable:
- More sophisticated pattern recognition and correlation analysis
- Better temporal trend identification and forecasting
- Enhanced cross-category insights and recommendations
- More personalized and actionable advice based on comprehensive data understanding`;
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

    // Get agent configuration
    const agentConfig = await getAgentConfig(agentId);
    if (!agentConfig) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    console.log('🔍 Analyzing categories for agent:', agentId);
    console.log('📋 Agent selected contexts:', agentConfig.selectedContextIds);
    
    // Analyze the agent's categories and map to expected field schemas
    const { categoryInfo, availableFields, contextAnalysis } = analyzeCategoryFields(
      agentConfig.selectedContextIds || []
    );
    
    // Generate context enhancement recommendations
    const contextRecommendations = generateContextRecommendations(
      agentConfig,
      availableFields,
      agentConfig.selectedContextIds || []
    );
    
    console.log('🔬 Category field analysis:', {
      availableFields: availableFields.slice(0, 10), // Log first 10 fields
      categoriesAnalyzed: agentConfig.selectedContextIds?.length || 0,
      totalFields: availableFields.length,
      hasRecommendations: contextRecommendations.length > 100
    });

    // Step 1: Get sample context data to enhance clarification
    let contextSamples = "";
    try {
      const contextDocs = await getAgentContext(agentId, "");
      if (contextDocs.length > 0) {
        contextSamples = contextDocs.slice(0, 2).map((doc, i) => 
          `Sample ${i + 1}: ${doc.pageContent.substring(0, 150)}...`
        ).join('\n');
      } else {
        contextSamples = "No sample context data available - this indicates limited data for comprehensive analysis";
      }
    } catch (error) {
      console.warn('⚠️ Could not retrieve sample context:', error);
      contextSamples = "Context data access limited - additional context uploads recommended";
    }

    // Step 2: Clarify categories and their meaning for this specific agent
    console.log('🧠 Clarifying categories and context for agent...');
    const clarificationModel = await initializeGeminiModel({
      maxOutputTokens: 1024,
      temperature: 0.3, // Lower temperature for more consistent analysis
    });

    const clarificationPrompt = PromptTemplate.fromTemplate(CATEGORY_CLARIFICATION_TEMPLATE);
    const clarificationChain = clarificationPrompt.pipe(clarificationModel).pipe(new StringOutputParser());

    const clarifiedAnalysis = await clarificationChain.invoke({
      agentName: agentConfig.name || "AI Assistant",
      agentDescription: agentConfig.description || "A helpful AI assistant",
      agentCategory: agentConfig.category || "General",
      agentUseCases: agentConfig.useCases || "General assistance and information",
      selectedContextIds: agentConfig.selectedContextIds?.join(', ') || 'None',
      categoryMappings: buildCategoryMappingsString(),
      contextSamples
    });

    console.log('✨ Categories clarified:', clarifiedAnalysis.substring(0, 200) + '...');

    // Step 3: Generate questions based on clarified understanding
    console.log('❓ Generating questions based on clarified analysis...');
    const questionModel = await initializeGeminiModel({
      maxOutputTokens: 1024,
      temperature: 0.8, // Higher temperature for more creative questions
    });

    const questionPrompt = PromptTemplate.fromTemplate(QUESTION_GENERATION_TEMPLATE);
    const questionChain = questionPrompt.pipe(questionModel).pipe(new StringOutputParser());

    console.log('🔧 Invoking question generation with clarified data:', {
      agentName: agentConfig.name || "AI Assistant",
      fieldCount: availableFields.length,
      categoriesCount: agentConfig.selectedContextIds?.length || 0,
      clarifiedAnalysisLength: clarifiedAnalysis.length,
      hasContextRecommendations: contextRecommendations.length > 100
    });

    const response = await questionChain.invoke({
      agentName: agentConfig.name || "AI Assistant",
      agentDescription: agentConfig.description || "A helpful AI assistant",
      agentCategory: agentConfig.category || "General",
      agentUseCases: agentConfig.useCases || "General assistance and information",
      clarifiedAnalysis,
      categoryFieldInfo: categoryInfo,
      contextAnalysis: contextAnalysis,
      contextRecommendations
    });

    console.log('🤖 Raw LLM response:', response);

    // Parse the JSON response
    try {
      const cleanedResponse = response.trim();
      console.log('🧹 Cleaned response:', cleanedResponse);
      
      // Try to find JSON in the response
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.warn('⚠️ No JSON found in response, using fallback');
        throw new Error("No JSON found in response");
      }
      
      console.log('📝 JSON match found:', jsonMatch[0]);
      const questionsData = JSON.parse(jsonMatch[0]);
      
      if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
        console.warn('⚠️ Invalid response format, using fallback');
        throw new Error("Invalid response format");
      }

      // Filter out any empty or invalid questions
      const validQuestions = questionsData.questions
        .filter((q: string) => q && typeof q === 'string' && q.trim().length > 0)
        .slice(0, 3);

      if (validQuestions.length === 0) {
        throw new Error("No valid questions found");
      }

      console.log('✅ Successfully generated clarified field-based questions:', validQuestions);

      return NextResponse.json({
        success: true,
        questions: validQuestions,
        agentId,
        agentName: agentConfig.name,
        clarified: true,
        contextRecommendations: contextRecommendations,
        fieldInfo: {
          availableFields: availableFields.slice(0, 15), // Return first 15 fields for debugging
          categoriesAnalyzed: agentConfig.selectedContextIds || [],
          totalFieldCount: availableFields.length,
          hasMultipleCategories: (agentConfig.selectedContextIds?.length || 0) > 1,
          clarificationUsed: true,
          contextCompleteness: {
            hasTemporalData: availableFields.some(f => f.includes('date') || f.includes('time')),
            hasQuantitativeData: availableFields.some(f => ['distance', 'duration', 'score', 'rating'].some(q => f.includes(q))),
            hasQualitativeData: availableFields.some(f => ['feeling', 'mood', 'notes', 'description'].some(q => f.includes(q))),
            recommendedCategories: contextRecommendations.split('•').length - 1
          }
        }
      });

    } catch (parseError) {
      console.error("Failed to parse LLM response:", parseError);
      console.error("Raw response:", response);
      
      // Enhanced fallback questions with context recommendations
      const { availableFields } = analyzeCategoryFields(agentConfig.selectedContextIds || []);
      
      const hasPhysicalFields = availableFields.some(f => ['distance', 'intensity', 'activity'].includes(f));
      const hasWorkFields = availableFields.some(f => ['projectName', 'productivity', 'focusLevel'].includes(f));
      const hasStudyFields = availableFields.some(f => ['subject', 'comprehension', 'studyMaterial'].includes(f));
      const hasGeneralFields = availableFields.some(f => ['content', 'category', 'type'].includes(f));
      
      let fallbackQuestions: string[] = [];
      
      if (hasPhysicalFields) {
        fallbackQuestions = [
          "What patterns can you identify in my activity data using fields like distance, intensity, and feeling?",
          "Based on my physical activity fields, what recommendations do you have for optimizing my fitness routine?",
          "How do different activity types correlate with my goal achievement and productivity levels?"
        ];
      } else if (hasWorkFields) {
        fallbackQuestions = [
          "What insights can you provide using my work data fields like projectName, productivity, and focusLevel?",
          "How can you help me optimize my work schedule based on my productivity and collaboration patterns?",
          "What correlations exist between my focus levels and task completion across different projects?"
        ];
      } else if (hasStudyFields) {
        fallbackQuestions = [
          "What learning patterns can you identify using fields like subject, comprehension, and study materials?",
          "How can you help improve my study sessions based on comprehension levels across different subjects?",
          "What study methods and materials show the best learning outcomes in my data?"
        ];
      } else if (hasGeneralFields) {
        fallbackQuestions = [
          "What content patterns and themes can you identify across my knowledge base?",
          "How can you help me organize and find connections in my personal information?",
          "What insights can you provide about my information consumption and creation patterns?"
        ];
      } else {
        // Context-limited fallback with recommendations
        fallbackQuestions = [
          `What initial insights can you provide based on the ${agentConfig.selectedContextIds?.join(' and ') || 'available'} categories you have access to?`,
          `How can you help me get started with the current data, and what additional context would improve your capabilities?`,
          `What basic patterns can you identify now, and what specific data should I upload to unlock deeper analysis?`
        ];
      }
      
      return NextResponse.json({
        success: true,
        questions: fallbackQuestions,
        agentId,
        agentName: agentConfig.name,
        fallback: true,
        clarified: false,
        contextRecommendations: contextRecommendations,
        fieldInfo: {
          availableFields: availableFields.slice(0, 15),
          categoriesAnalyzed: agentConfig.selectedContextIds || [],
          totalFieldCount: availableFields.length,
          hasMultipleCategories: (agentConfig.selectedContextIds?.length || 0) > 1,
          clarificationUsed: false,
          contextCompleteness: {
            hasTemporalData: availableFields.some(f => f.includes('date') || f.includes('time')),
            hasQuantitativeData: availableFields.some(f => ['distance', 'duration', 'score', 'rating'].some(q => f.includes(q))),
            hasQualitativeData: availableFields.some(f => ['feeling', 'mood', 'notes', 'description'].some(q => f.includes(q))),
            recommendedCategories: contextRecommendations.split('•').length - 1
          }
        }
      });
    }

  } catch (error) {
    console.error("Error generating questions:", error);
    return NextResponse.json(
      { 
        error: "Failed to generate questions",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 