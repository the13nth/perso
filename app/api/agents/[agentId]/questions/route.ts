import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAgentConfig } from "@/lib/pinecone";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

// Adjust timeout for Netlify - more realistic deployment constraints

// Optimized timeout wrapper for async operations

// Type for agent configuration
interface AgentConfig {
  name?: string;
  description?: string;
  selectedContextIds?: string[];
}

// Initialize Pinecone and embeddings
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || "",
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY || "",
  modelName: "embedding-001",
});

// Simple question generation template that uses actual user data content
const QUESTION_TEMPLATE = `You are helping generate relevant questions that a user can ask an AI agent about their data.

AGENT CONTEXT:
Name: {agentName}
Description: {agentDescription}
Contexts: {contexts}

USER'S DATA SAMPLES:
{dataSamples}

Based on the agent's purpose and the actual data samples provided, generate 3 specific and relevant questions that the user could ask this AI agent.

The questions should:
1. Reference actual content from the data samples when possible
2. Help users understand insights from their data
3. Be specific to the agent's purpose and contexts
4. If the agent has email access, include questions about email patterns, important communications, or email organization

If there isn't enough data, generate general questions about the agent's capabilities.

Format your response as a simple numbered list:
1. [First Question]
2. [Second Question]
3. [Third Question]

IMPORTANT: Use ONLY the numbered list format above, no other text or formatting.`;

// Fetch data samples based on agent's selected contexts
async function fetchDataSamples(contextIds: string[], userId: string): Promise<string[]> {
  console.log('Fetching data samples for contexts:', contextIds);
  
  try {
    const samples: string[] = [];
    
    // If emails are needed, fetch them from the debug endpoint
    if (contextIds.includes('Emails')) {
      console.log('[fetchDataSamples] Fetching emails from debug endpoint...');
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      // Get the current request's auth session
      const session = await auth();
      const token = await session.getToken();
      
      if (!token) {
        console.error('[fetchDataSamples] No auth token available');
      } else {
        const emailResponse = await fetch(`${baseUrl}/api/integrations/gmail/debug`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log(`[fetchDataSamples] Found ${emailData.emails.length} emails`);
          
          // Create rich summaries from the email metadata
          const emailSummaries = emailData.emails.map((email: any) => `
Email from ${email.from}
Subject: ${email.subject}
Date: ${email.date}

This email was received from ${email.from.split('<')[0].trim()} with subject "${email.subject}" on ${email.date}.
`.trim());

          samples.push(...emailSummaries);
        } else {
          console.error(`[fetchDataSamples] Failed to fetch emails: ${emailResponse.status} ${emailResponse.statusText}`);
        }
      }
    }

    // Also fetch any other context data from Pinecone
    const index = pinecone.index(process.env.PINECONE_INDEX || "");
    
    // Filter for non-email contexts
    const nonEmailContexts = contextIds.filter(ctx => ctx !== 'Emails');
    if (nonEmailContexts.length > 0) {
      const filter = {
        $and: [
          { userId: { $eq: userId } },
          { categories: { $in: nonEmailContexts } }
        ]
      };

      console.log('Querying Pinecone with filter:', JSON.stringify(filter, null, 2));

      const queryResponse = await index.query({
        vector: await embeddings.embedQuery("sample content"),
        filter: filter,
        topK: 25,
        includeMetadata: true
      });

      console.log('Query response:', JSON.stringify(queryResponse, null, 2));

      // Extract text samples from matches
      const pineconeTexts = queryResponse.matches
        ?.map(match => match.metadata?.text)
        .filter((text): text is string => typeof text === 'string') || [];
      
      samples.push(...pineconeTexts);
    }

    console.log(`[fetchDataSamples] Total samples found: ${samples.length}`);
    return samples;
  } catch (_error) {
    console.error('Error fetching data samples:', _error);
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  console.log('Starting question generation...');
  
  const session = await auth();
  const userId = session?.userId;
  
  if (!userId) {
    console.log('Unauthorized: No user ID found');
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Await the params promise
    const { agentId } = await params;
    console.log('Getting agent config for:', agentId);
    console.log('Request URL:', request.url);

    if (!agentId) {
      console.error('Missing agentId in request params');
      return NextResponse.json({
        success: false,
        error: "Missing agentId parameter"
      }, { status: 400 });
    }

    // Get agent configuration
    const agentConfig = await getAgentConfig(agentId) as AgentConfig;
    console.log('Agent config:', agentConfig);
    
    if (!agentConfig) {
      console.error('Agent config not found for ID:', agentId);
      return NextResponse.json({
        success: false,
        error: "Agent configuration not found"
      }, { status: 404 });
    }

    const contextIds = agentConfig.selectedContextIds || [];
    
    // Fetch data samples for these contexts
    console.log('Fetching data samples for contexts:', contextIds);
    const samples = await fetchDataSamples(contextIds, userId);
    console.log(`Found ${samples.length} samples`);

    // Initialize the model
    console.log('Initializing model...');
    const model = await initializeGeminiModel({
      maxOutputTokens: 1024,
      temperature: 0.7
    });
    
    // Create the chain
    const chain = new PromptTemplate({
      template: QUESTION_TEMPLATE,
      inputVariables: ["agentName", "agentDescription", "contexts", "dataSamples"],
    })
    .pipe(model)
    .pipe(new StringOutputParser());

    // Generate questions
    console.log('Generating questions...');
    const response = await chain.invoke({
      agentName: agentConfig.name || "AI Agent",
      agentDescription: agentConfig.description || "",
      contexts: contextIds.join(", "),
      dataSamples: samples.join("\n\n")
    });

    // Parse the numbered list response
    const questions = response
      .split("\n")
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, "").trim());

    console.log('Generated questions:', questions);

    // If no questions generated, use defaults based on agent type
    if (questions.length === 0) {
      console.log('No questions generated, using defaults');
      const context = contextIds[0] || agentConfig.name?.toLowerCase() || 'data';
      const defaultQuestions = [
        `What insights can you provide about my ${context} activities?`,
        `How can you help me improve my ${context} performance?`,
        `What patterns do you notice in my ${context} data?`
      ];

      return NextResponse.json({
        success: true,
        questions: defaultQuestions,
        fallback: true
      });
    }

    return NextResponse.json({
      success: true,
      questions,
      fallback: false,
      dataInfo: {
        samplesFound: samples.length,
        contexts: contextIds
      }
    });

  } catch (_error) {
    console.error("Error generating questions:", _error);
    const errorMessage = _error instanceof Error ? _error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    
    return NextResponse.json({
      success: false,
      error: "Failed to generate questions",
      message: errorMessage
    }, { status: 500 });
  }
}