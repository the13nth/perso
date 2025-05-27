import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { storeAgentWithContext } from '@/lib/pinecone';
import { Document } from '@langchain/core/documents';
import { v4 as uuidv4 } from 'uuid';

// Types
interface CreateAgentRequest {
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string;
  isPublic: boolean;
  selectedCategories: string[];
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: CreateAgentRequest = await req.json();

    // Get base URL from the request
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${req.headers.get('host')}`;

    // Forward the authorization header
    const authHeader = req.headers.get('authorization');
    
    // Fetch embeddings for selected categories
    const response = await fetch(`${baseUrl}/api/embeddings?limit=1000`, {
      headers: {
        'authorization': authHeader || '',
        'cookie': req.headers.get('cookie') || ''
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch embeddings');
    }
    const data = await response.json();
    
    // Filter embeddings by selected categories
    const relevantEmbeddings = data.embeddings.filter((emb: any) => {
      const embCategories = Array.isArray(emb.metadata.categories) 
        ? emb.metadata.categories 
        : [emb.metadata.category || 'Uncategorized'];
      return body.selectedCategories.some(cat => embCategories.includes(cat));
    });

    // Convert embeddings to documents
    const contextDocuments = relevantEmbeddings.map((emb: any) => new Document({
      pageContent: emb.metadata.text || '',
      metadata: {
        ...emb.metadata,
        source: emb.id
      }
    }));

    // Generate a unique ID for the agent
    const agentId = uuidv4();

    // Store agent with context
    const agentMetadata = await storeAgentWithContext(
      agentId,
      {
        name: body.name,
        description: body.description,
        category: body.category,
        useCases: body.useCases,
        triggers: body.triggers?.split(',').map(t => t.trim()).filter(Boolean) || [],
        isPublic: body.isPublic,
        capabilities: [],
        tools: [],
        text: body.description,
        userId,
        type: 'agent_config'
      },
      contextDocuments,
      body.selectedCategories,
      userId
    );
    
    return NextResponse.json({
      success: true,
      agentId: agentMetadata.agentId,
      name: agentMetadata.name,
      description: agentMetadata.description,
      category: agentMetadata.category,
      isPublic: agentMetadata.isPublic
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
} 