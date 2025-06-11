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

interface EmbeddingMetadata {
  text: string;
  categories?: string[];
  category?: string;
  [key: string]: unknown;
}

interface Embedding {
  id: string;
  metadata: EmbeddingMetadata;
  values?: number[];
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
    const data: { embeddings: Embedding[] } = await response.json();
    
    // Filter embeddings by selected categories
    const relevantEmbeddings = data.embeddings.filter((emb) => {
      const embCategories = Array.isArray(emb.metadata.categories) 
        ? emb.metadata.categories 
        : [emb.metadata.category || 'Uncategorized'];
      return body.selectedCategories.some(cat => embCategories.includes(cat));
    });

    // Convert embeddings to documents
    const contextDocuments = relevantEmbeddings.map((emb) => new Document({
      pageContent: emb.metadata.text || '',
      metadata: {
        ...emb.metadata,
        source: emb.id
      }
    }));

    // Generate a unique ID for the agent
    const agentId = uuidv4();
    const timestamp = new Date().toISOString();

    // If agent needs email or calendar access, trigger data ingestion
    if (body.selectedCategories?.includes('Emails')) {
      console.log(`[AGENT CREATE] Starting email ingestion for new agent ${agentId}`);
      // Ingest emails
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/retrieval/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'email',
          metadata: {
            agentId,
            userId,
            type: 'email'
          }
        })
      });

      const result = await response.json();
      console.log(`[AGENT CREATE] Email ingestion result:`, result);

      if (!response.ok) {
        console.error('[AGENT CREATE] Failed to ingest emails:', result);
        throw new Error('Failed to ingest emails');
      }
    }

    if (body.selectedCategories?.includes('Calendar')) {
      console.log(`[AGENT CREATE] Starting calendar ingestion for new agent ${agentId}`);
      // Ingest calendar events
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/retrieval/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': authHeader || '',
          'cookie': req.headers.get('cookie') || ''
        },
        body: JSON.stringify({
          type: 'calendar',
          metadata: {
            agentId,
            userId,
            type: 'calendar'
          }
        })
      });

      const result = await response.json();
      console.log(`[AGENT CREATE] Calendar ingestion result:`, result);

      if (!response.ok) {
        console.error('[AGENT CREATE] Failed to ingest calendar events:', result);
        throw new Error('Failed to ingest calendar events');
      }
    }

    // Store agent with context
    const agentMetadata = await storeAgentWithContext(
      agentId,
      {
        // Core Metadata
        contentType: 'agent_config' as const,
        contentId: agentId,
        userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        status: 'active' as const,

        // Chunking Information (not applicable for agents)
        chunkIndex: 0,
        totalChunks: 1,
        isFirstChunk: true,

        // Access Control
        access: body.isPublic ? 'public' : 'personal',
        sharedWith: [],

        // Classification & Organization
        primaryCategory: body.category,
        secondaryCategories: body.selectedCategories,
        tags: body.triggers?.split(',').map(t => t.trim()).filter(Boolean) || [],

        // Content Fields
        name: body.name,
        description: body.description,
        title: body.name,
        text: body.description,
        summary: body.useCases,

        // Search Optimization
        searchableText: `${body.name} ${body.description} ${body.useCases}`,
        keywords: [...(body.triggers?.split(',').map(t => t.trim()).filter(Boolean) || []), body.category],
        language: 'en',

        // Relationships
        relatedIds: [],
        references: [],

        // Agent-specific metadata
        agent: {
          type: 'agent_config',
          capabilities: [],
          tools: [],
          useCases: body.useCases,
          triggers: body.triggers?.split(',').map(t => t.trim()).filter(Boolean) || [],
          isPublic: body.isPublic,
          ownerId: userId,
          dataAccess: [],
          selectedContextIds: contextDocuments.map(doc => doc.metadata.source),
          performanceMetrics: {
            taskCompletionRate: 0,
            averageResponseTime: 0,
            userSatisfactionScore: 0,
            totalTasksCompleted: 0
          }
        }
      },
      contextDocuments,
      body.selectedCategories,
      userId
    );
    
    return NextResponse.json({
      success: true,
      agentId: agentMetadata.contentId,
      name: agentMetadata.name,
      description: agentMetadata.description,
      category: agentMetadata.primaryCategory,
      isPublic: agentMetadata.isPublic
    });
  } catch (_error) {
    console.error('Error creating agent:', _error);
    return NextResponse.json(
      { success: false, error: _error instanceof Error ? _error.message : "An error occurred" },
      { status: 500 }
    );
  }
} 