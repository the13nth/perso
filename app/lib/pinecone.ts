import { Pinecone, Index, RecordMetadata, RecordMetadataValue } from '@pinecone-database/pinecone';
import { Document } from '@langchain/core/documents';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('Missing PINECONE_INDEX environment variable');
}

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY!,
  modelName: "embedding-001",
});

let index: Index;

interface PineconeMetadata extends RecordMetadata {
  agentId: string;
  content: string;
  source: string;
  type: string;
  score: string;
}

export interface AgentMetadata {
  [key: string]: string | number | boolean | string[] | Record<string, any> | undefined;
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  selectedContextIds: string[];
  isPublic: boolean;
  ownerId: string;
  type: string;
  createdAt: number;
  updatedAt: number;
  contentId?: string;
  primaryCategory?: string;
  agent?: {
    isPublic: boolean;
    type: string;
    capabilities: string[];
    tools: string[];
    useCases: string;
    triggers: string[];
    ownerId: string;
    dataAccess: string[];
    selectedContextIds: string[];
    performanceMetrics: {
      taskCompletionRate: number;
      averageResponseTime: number;
      userSatisfactionScore: number;
      totalTasksCompleted: number;
    };
  };
}

export interface PineconeDocument {
  pageContent: string;
  metadata: {
    id: string;
    vector: number[];
    type?: string;
    title?: string;
    source?: string;
    access?: string;
    categories?: string[];
  };
}

async function initIndex() {
  if (!process.env.PINECONE_INDEX) {
    throw new Error('Missing PINECONE_INDEX environment variable');
  }
  
  if (!index) {
    index = pinecone.index(process.env.PINECONE_INDEX);
  }
  
  return index;
}

export async function storeAgentWithContext(
  agentId: string,
  config: unknown,
  contextDocuments: Document[],
  selectedContextIds: string[],
  ownerId: string
): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  const agentConfig = config as Partial<AgentMetadata>;
  
  // Normalize the agent ID
  const normalizedId = agentId.replace(/^agent_/, '');
  const prefixedId = `agent_${normalizedId}`;
  
  // Store agent metadata
  const metadata: AgentMetadata = {
    agentId: normalizedId, // Store normalized ID in metadata
    name: agentConfig.name || '',
    description: agentConfig.description || '',
    category: agentConfig.category || '',
    useCases: agentConfig.useCases || '',
    selectedContextIds,
    isPublic: agentConfig.isPublic ?? false,
    ownerId,
    type: 'agent_config',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    contentId: agentConfig.contentId,
    primaryCategory: agentConfig.primaryCategory,
    agent: agentConfig.agent
  };

  // Store agent configuration with embedding
  const configEmbedding = await embeddings.embedQuery(
    `${metadata.name} ${metadata.description} ${metadata.useCases}`
  );
  
  await index.upsert([{
    id: prefixedId, // Use prefixed ID for storage
    values: configEmbedding,
    metadata: metadata as unknown as RecordMetadata
  }]);

  // Store context documents with embeddings
  if (contextDocuments.length > 0) {
    const contextUpserts = await Promise.all(
      contextDocuments.map(async (doc, i) => {
        const embedding = await embeddings.embedQuery(doc.pageContent);
        const metadata: PineconeMetadata = {
          agentId,
          content: doc.pageContent,
          type: 'context',
          source: doc.metadata?.source as string || 'Unknown',
          score: "1.0"  // Default score for direct context
        };
        return {
          id: `${agentId}_context_${i}`,
          values: embedding,
          metadata: metadata as unknown as RecordMetadata
        };
      })
    );

    // Upsert in batches to avoid rate limits
    const batchSize = 100;
    for (let i = 0; i < contextUpserts.length; i += batchSize) {
      const batch = contextUpserts.slice(i, i + batchSize);
      await index.upsert(batch);
    }
  }

  return metadata;
}

export async function getAgentConfig(agentId: string): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  // Normalize the agent ID
  const normalizedId = agentId.replace(/^agent_/, '');
  const prefixedId = `agent_${normalizedId}`;
  
  console.log('Fetching agent with normalized ID:', normalizedId);
  console.log('Using Pinecone index:', process.env.PINECONE_INDEX);
  
  // Try fetching with both formats
  const response = await index.fetch([prefixedId]);
  
  if (!response.records[prefixedId]) {
    console.log('Agent not found with ID:', prefixedId);
    throw new Error('Agent not found');
  }

  const metadata = response.records[prefixedId].metadata as AgentMetadata;
  
  // Ensure consistent ID format in metadata
  metadata.agentId = normalizedId;
  
  return metadata;
}

export async function getAgentContext(agentId: string, query?: string): Promise<Document[]> {
  const index = await initIndex();
  const agentConfig = await getAgentConfig(agentId);
  
  const queryEmbedding = query 
    ? await embeddings.embedQuery(query)
    : await embeddings.embedQuery("general context");

  // Query for relevant context
  const queryResponse = await index.query({
    vector: queryEmbedding,
    filter: {
      agentId: { $eq: agentId },
      type: { $eq: "context" }
    },
    includeMetadata: true,
    topK: 10
  });

  // Convert to Documents
  return queryResponse.matches.map(match => {
    const metadata = match.metadata as PineconeMetadata;
    return new Document({
      pageContent: metadata.content,
      metadata: {
        source: metadata.source,
        score: parseFloat(metadata.score)
      }
    });
  });
}

export async function initIndexes() {
  if (!process.env.PINECONE_INDEX) {
    throw new Error('Missing PINECONE_INDEX environment variable');
  }
  
  index = pinecone.index(process.env.PINECONE_INDEX!);
}

export async function initPinecone() {
  return new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || "",
  });
}

export async function upsertDocuments(documents: PineconeDocument[], userId: string) {
  const pinecone = await initPinecone();
  const index = pinecone.index(process.env.PINECONE_INDEX!);

  // Process documents in batches
  const batchSize = 100;
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const records = batch.map(doc => ({
      id: doc.metadata.id,
      values: doc.metadata.vector,
      metadata: {
        text: doc.pageContent,
        userId,
        type: doc.metadata.type || "document",
        title: doc.metadata.title || "",
        source: doc.metadata.source || "",
        access: doc.metadata.access || "private",
        categories: doc.metadata.categories || [],
        createdAt: new Date().toISOString()
      } as Record<string, RecordMetadataValue>
    }));
    await index.upsert(records);
  }
}

export async function getExistingCategories(): Promise<string[]> {
  if (!index) await initIndexes();
  
  const queryResponse = await index.query({
    vector: await embeddings.embedQuery("list all categories"),
    filter: { type: "category" },
    topK: 100
  });

  // Extract unique categories from metadata
  const categories = new Set<string>();
  queryResponse.matches.forEach(match => {
    if (match.metadata?.category) {
      categories.add(String(match.metadata.category));
    }
  });

  return Array.from(categories);
}

// Define the functions first
async function getContextCategoriesImpl(content: string): Promise<string[]> {
  if (!index) await initIndexes();

  const contentEmbedding = await embeddings.embedQuery(content);
  const queryResponse = await index.query({
    vector: contentEmbedding,
    filter: { type: "category" },
    topK: 3 // Get top 3 matching categories
  });

  return queryResponse.matches
    .filter(match => match.score && match.score > 0.7) // Only keep strong matches
    .map(match => String(match.metadata?.category))
    .filter(Boolean);
}

// Export the functions
export const getContextCategories = getContextCategoriesImpl;

export async function listPublicAgents(): Promise<AgentMetadata[]> {
  const queryVector = await embeddings.embedQuery("public agents");
  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: 'agent_config', isPublic: true },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches
    .filter(match => match.metadata)
    .map(match => match.metadata as unknown as AgentMetadata);
}

export async function listUserAgents(ownerId: string): Promise<AgentMetadata[]> {
  const queryVector = await embeddings.embedQuery(ownerId);
  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: 'agent_config', ownerId },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches
    .filter(match => match.metadata)
    .map(match => match.metadata as unknown as AgentMetadata);
}

export async function queryAgentsByContext(agentId: string, query: string) {
  const pinecone = await initPinecone();
  const index = pinecone.index(process.env.PINECONE_INDEX!);

  const queryEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY!,
    modelName: "embedding-001",
  });

  const queryEmbedding = await queryEmbeddings.embedQuery(query);

  const results = await index.query({
    vector: queryEmbedding,
    includeMetadata: true,
    topK: 10,
    filter: {
      agentId: { $eq: agentId },
      type: { $eq: "agent_context" }
    }
  });

  return results.matches.map(match => {
    const metadata = match.metadata as Record<string, RecordMetadataValue>;
    return {
      agentId: String(metadata.agentId || ""),
      name: String(metadata.name || ""),
      description: String(metadata.description || ""),
      category: String(metadata.category || ""),
      useCases: String(metadata.useCases || ""),
      selectedContextIds: Array.isArray(metadata.selectedContextIds) ? metadata.selectedContextIds : [],
      isPublic: Boolean(metadata.isPublic),
      ownerId: String(metadata.ownerId || ""),
      type: String(metadata.type || ""),
      createdAt: Number(metadata.createdAt || Date.now()),
      updatedAt: Number(metadata.updatedAt || Date.now())
    } as AgentMetadata;
  });
}

export async function getAgentConfigV6(agentId: string): Promise<AgentMetadata | null> {
  const index = await initIndex();

  const queryResponse = await index.query({
    vector: await embeddings.embedQuery(agentId),
    filter: { agentId, type: "agent_config" },
    topK: 1,
  });

  if (!queryResponse.matches?.length) {
    return null;
  }

  const metadata = queryResponse.matches[0].metadata as unknown as AgentMetadata;
  return metadata;
}

export async function getPublicAgents(): Promise<AgentMetadata[]> {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "embedding-001",
  });

  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const queryVector = await embeddings.embedQuery("public agents");

  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: "agent_config", isPublic: true },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches.map(match => match.metadata as unknown as AgentMetadata);
}

export async function getAgentsByOwner(ownerId: string): Promise<AgentMetadata[]> {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "embedding-001",
  });

  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const queryVector = await embeddings.embedQuery(ownerId);

  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: "agent_config", ownerId },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches.map(match => match.metadata as unknown as AgentMetadata);
}

export async function initSystemContexts() {
  if (!index) await initIndexes();

  // Get existing categories from embeddings
  const existingCategories = await getExistingCategories();
  console.log('Found existing categories:', existingCategories);

  // Create embeddings and store in Pinecone
  const systemContexts = [];

  // Store category embeddings
  for (const category of existingCategories) {
    const embedding = await embeddings.embedQuery(category);
    systemContexts.push({
      id: `system_category_${category.toLowerCase().replace(/\s+/g, '_')}`,
      values: embedding,
      metadata: {
        category,
        type: 'category',
        source: 'system'
      }
    });
  }

  // Store status indicators (these are system-level concepts)
  const statusTypes = ['active', 'completed', 'pending', 'blocked'];
  for (const status of statusTypes) {
    const embedding = await embeddings.embedQuery(status);
    systemContexts.push({
      id: `system_status_${status}`,
      values: embedding,
      metadata: {
        status,
        type: 'status',
        source: 'system'
      }
    });
  }

  // Store all system contexts
  if (systemContexts.length > 0) {
    await index.upsert(systemContexts);
    console.log(`Stored ${systemContexts.length} system contexts`);
  }
}

let pineconeClient: Pinecone | null = null;

export async function getPineconeClient(): Promise<Pinecone> {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
} 