import { Pinecone, Index, RecordMetadata, ScoredPineconeRecord, RecordMetadataValue } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
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
  [key: string]: string | number | boolean | string[];
  agentId: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  ownerId: string;
  useCases: string;
  selectedContextIds: string[];
  type: string;
  createdAt: number;
  updatedAt: number;
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
  const index = await initIndex();
  const agentConfig = config as Partial<AgentMetadata>;
  
  // Store agent metadata
  const metadata: AgentMetadata = {
    agentId,
    name: agentConfig.name || '',
    description: agentConfig.description || '',
    category: agentConfig.category || '',
    useCases: agentConfig.useCases || '',
    selectedContextIds,
    isPublic: agentConfig.isPublic || false,
    ownerId,
    type: 'agent_config',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // Store agent configuration with embedding
  const configEmbedding = await embeddings.embedQuery(
    `${metadata.name} ${metadata.description} ${metadata.useCases}`
  );
  
  await index.upsert([{
    id: `agent_${agentId}`,
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
  const index = await initIndex();
  const response = await index.fetch([`agent_${agentId}`]);
  
  const agent = response.records[`agent_${agentId}`];
  if (!agent || !agent.metadata) {
    throw new Error('Agent not found');
  }

  return agent.metadata as unknown as AgentMetadata;
}

export async function getAgentContext(agentId: string, query?: string): Promise<Document[]> {
  const index = await initIndex();
  
  // Get agent config to check access permissions
  const agentConfig = await getAgentConfig(agentId);
  
  // Get query embedding
  const queryEmbedding = query 
    ? await embeddings.embedQuery(query)
    : await embeddings.embedQuery("general context");

  // Query for relevant context with a more inclusive filter
  const response = await index.query({
    vector: queryEmbedding,
    filter: {
      $or: [
        { agentId }, // Match any context linked to this agent
        { id: { $in: agentConfig.selectedContextIds || [] } }, // Include selected contexts
        { type: 'context', agentId } // Include agent-specific context
      ]
    },
    topK: 10,
    includeMetadata: true,
    includeValues: false
  });

  console.log('Context query response:', {
    matchCount: response.matches.length,
    agentId,
    query,
    filter: {
      $or: [
        { agentId },
        { id: { $in: agentConfig.selectedContextIds || [] } },
        { type: 'context', agentId }
      ]
    }
  });

  // Convert to documents and sort by relevance
  const documents = response.matches
    .filter((match): match is ScoredPineconeRecord<PineconeMetadata> => 
      match.metadata !== undefined && 
      typeof match.metadata.content === 'string'
    )
    .map(match => new Document({
      pageContent: match.metadata!.content,
      metadata: {
        source: match.metadata!.source || 'Unknown',
        score: match.score || 0
      }
    }))
    .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

  console.log('Processed documents:', {
    count: documents.length,
    scores: documents.map(doc => doc.metadata?.score || 0)
  });

  return documents;
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

export async function listPublicAgents() {
  const queryVector = await embeddings.embedQuery("public agents");
  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: 'agent_config', isPublic: true },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches.map(match => match.metadata as unknown as AgentMetadata);
}

export async function listUserAgents(ownerId: string) {
  const queryVector = await embeddings.embedQuery(ownerId);
  const queryResponse = await index.query({
    vector: queryVector,
    filter: { type: 'agent_config', ownerId },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches.map(match => match.metadata as unknown as AgentMetadata);
}

export async function queryAgentsByContext(agentId: string, query: string) {
  const pinecone = await initPinecone();
  const index = pinecone.index(process.env.PINECONE_INDEX!);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY || "",
    modelName: "text-embedding-004",
  });

  const queryEmbedding = await embeddings.embedQuery(query);

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