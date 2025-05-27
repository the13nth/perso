import { NextRequest, NextResponse } from 'next/server';
import { Document } from 'langchain/document';
import { storeAgentWithContext } from '@/lib/pinecone';
import { auth } from '@clerk/nextjs/server';

// Types
interface AgentConfig {
  name: string;
  description: string;
  logo?: string;
  category: string;
  useCases: string;
  triggers: string[];
  apiIntegrations?: string;
  dataAccess: string[];
  deploymentOptions: string[];
  isPublic: boolean;
  contextFiles?: File[];
  selectedContextIds?: string[];
  [key: string]: any;
}

export async function POST(req: NextRequest) {
  try {
    // Get user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized: You must be logged in to create an agent" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const agentConfig: Partial<AgentConfig> = {};
    const contextFiles: File[] = [];
    let selectedContextIds: string[] = [];

    // Extract agent configuration from form data
    formData.forEach((value, key) => {
      if (key === 'contextFiles') {
        if (value instanceof File) {
          contextFiles.push(value);
        }
      } else if (key === 'selectedContextIds') {
        selectedContextIds = JSON.parse(value as string);
      } else {
        agentConfig[key] = value;
      }
    });

    // Validate required fields
    if (!agentConfig.name || !agentConfig.description || !agentConfig.category) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process context files into documents
    const contextDocuments: Document[] = await Promise.all(
      contextFiles.map(async (file) => {
        const text = await file.text();
        return new Document({
          pageContent: text,
          metadata: {
            source: file.name,
            type: file.type,
            size: file.size,
          },
        });
      })
    );

    // Generate a unique agent ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Store agent configuration and context in Pinecone
    const agentMetadata = await storeAgentWithContext(
      agentId,
      agentConfig,
      contextDocuments,
      selectedContextIds,
      userId
    );

    return NextResponse.json({
      success: true,
      message: 'Agent configuration saved successfully',
      agentId,
      metadata: agentMetadata,
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
} 