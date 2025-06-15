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

DATA AVAILABILITY:
{dataSamples}

Based on the agent's purpose and data availability, generate 3 specific and relevant questions.

RULES:
1. If actual data samples are provided, create questions that reference specific data points
2. If NO data samples are provided, generate questions about:
   - The agent's general capabilities
   - How to provide/upload relevant data
   - What types of insights the agent could provide once data is available
3. NEVER generate questions that assume data exists when it doesn't
4. Be explicit when asking about hypothetical scenarios vs actual data

Format your response as a simple numbered list:
1. [First Question]
2. [Second Question]
3. [Third Question]

IMPORTANT: Use ONLY the numbered list format above, no other text or formatting.`;

// Fetch data samples based on agent's selected contexts
async function fetchDataSamples(contextIds: string[], userId: string): Promise<string[]> {
  try {
    const samples: string[] = [];
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    const filter = {
      $and: [
        { userId: { $eq: userId } },
        { categories: { $in: contextIds } }
      ]
    };

    const queryResponse = await index.query({
      vector: await embeddings.embedQuery("sample content"),
      filter: filter,
      topK: 25,
      includeMetadata: true
    });

    const pineconeTexts = queryResponse.matches
      ?.map(match => match.metadata?.text)
      .filter((text): text is string => typeof text === 'string') || [];
    
    samples.push(...pineconeTexts);
    return samples;
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
      temperature: 0.7
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