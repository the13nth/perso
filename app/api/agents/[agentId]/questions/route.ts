import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Initialize Pinecone and embeddings
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY || "",
  modelName: "embedding-001",
});

// Type for agent configuration
interface AgentConfig {
  name?: string;
  description?: string;
  selectedContextIds?: string[];
}

// Simple question generation template
const QUESTION_TEMPLATE = `You are helping generate relevant questions that a user can ask an AI agent about their data.

AGENT CONTEXT:
Name: {agentName}
Description: {agentDescription}
Contexts: {contexts}

DATA SAMPLES:
{dataSamples}

TASK:
Generate 3 UNIQUE and HIGHLY SPECIFIC questions that demonstrate the agent's capabilities. Each question must be different in both topic and type.

REQUIREMENTS:
1. CONTEXT UTILIZATION:
   - If data samples are available:
     * MUST reference specific data points, metrics, or patterns from the samples
     * Use actual values, dates, or categories from the data
     * Focus on insights that can be derived from the available data
   - If no data samples:
     * Focus on the agent's specific expertise areas mentioned in description
     * Ask about data upload/connection process
     * Inquire about potential insights once data is available

2. QUESTION DIVERSITY:
   Each question MUST be a different type:
   - ANALYTICAL: Ask for patterns, trends, or insights
   - ACTIONABLE: Request specific recommendations or actions
   - EXPLORATORY: Investigate relationships or correlations

3. SPECIFICITY RULES:
   - Include specific metrics, timeframes, or categories when available
   - Reference actual context categories provided
   - Use domain-specific terminology from the agent description
   - Make questions impossible to answer with generic responses

4. FORBIDDEN:
   - NO generic questions like "What can you do?"
   - NO repetitive question structures
   - NO questions that could apply to any agent
   - NO questions about unavailable data
   - NEVER repeat the same topic or analysis type

Format your response as a simple numbered list:
1. [First Question - MUST be Analytical]
2. [Second Question - MUST be Actionable]
3. [Third Question - MUST be Exploratory]

IMPORTANT: Use ONLY the numbered list format above, no other text or formatting.`;

// Fetch data samples based on agent's selected contexts
async function fetchDataSamples(contextIds: string[], userId: string): Promise<string[]> {
  try {
    const samples: string[] = [];
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Generate multiple diverse queries to get different types of samples
    const queryPromises = [
      // Query for recent data
      index.query({
        vector: await embeddings.embedQuery("most recent data points"),
        filter: {
          $and: [
            { userId: { $eq: userId } },
            { categories: { $in: contextIds } }
          ]
        },
        topK: 10,
        includeMetadata: true
      }),
      // Query for important patterns
      index.query({
        vector: await embeddings.embedQuery("significant patterns or trends"),
        filter: {
          $and: [
            { userId: { $eq: userId } },
            { categories: { $in: contextIds } }
          ]
        },
        topK: 10,
        includeMetadata: true
      }),
      // Query for unique insights
      index.query({
        vector: await embeddings.embedQuery("unique or unusual data points"),
        filter: {
          $and: [
            { userId: { $eq: userId } },
            { categories: { $in: contextIds } }
          ]
        },
        topK: 10,
        includeMetadata: true
      })
    ];

    // Wait for all queries to complete
    const queryResults = await Promise.all(queryPromises);
    
    // Process and combine results
    for (const response of queryResults) {
      const pineconeTexts = response.matches
        ?.map(match => match.metadata?.text)
        .filter((text): text is string => typeof text === 'string') || [];
      
      samples.push(...pineconeTexts);
    }

    // Shuffle the samples to ensure randomness
    const shuffledSamples = samples
      .sort(() => Math.random() - 0.5)
      .slice(0, 25); // Limit to 25 samples for diversity

    return shuffledSamples;
  } catch (error) {
    console.error('Error fetching data samples:', error);
    return [];
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  try {
    const session = await auth();
    const userId = session?.userId;
    
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await params;
    if (!agentId) {
      return Response.json({
        success: false,
        error: "Missing agentId parameter"
      }, { status: 400 });
    }

    const agentConfig = await getAgentConfig(agentId) as AgentConfig;
    if (!agentConfig) {
      return Response.json({
        success: false,
        error: "Agent configuration not found"
      }, { status: 404 });
    }

    const contextIds = agentConfig.selectedContextIds || [];
    const samples = await fetchDataSamples(contextIds, userId);

    const model = await initializeGeminiModel({
      maxOutputTokens: 1024,
      temperature: 0.1  
    });

    const prompt = new PromptTemplate({
      template: QUESTION_TEMPLATE,
      inputVariables: ["agentName", "agentDescription", "contexts", "dataSamples"]
    });

    const chain = prompt.pipe(model).pipe(new StringOutputParser());

    const response = await chain.invoke({
      agentName: agentConfig.name || "AI Agent",
      agentDescription: agentConfig.description || "No description provided",
      contexts: contextIds.join(", ") || "No contexts selected",
      dataSamples: samples.length > 0 ? samples.join("\n\n") : "No data samples available"
    });

    return Response.json({
      success: true,
      questions: response.split("\n").filter(q => q.trim())
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    return Response.json({
      success: false,
      error: "Failed to generate questions"
    }, { status: 500 });
  }
}