import { Pinecone, Index, RecordMetadata, PineconeRecord, RecordMetadataValue } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Vector dimension must match the Pinecone index dimension
const VECTOR_DIMENSION = 768;

export interface UserContext {
  id: string;
  userId: string;
  title: string;
  description?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  category?: string;
}

export interface AgentMetadata extends RecordMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
  userId: string;
  ownerId: string;
  useCases: string;
  triggers: string[];
  dataAccess: string[];
  selectedContextIds: string[];
  type: string;
}

export type MetadataValue = string | number | boolean | string[];

// Our application's metadata types
export interface AppMetadata {
  agentId?: string;
  userId: string;
  content: string;
  source?: string;
  title: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
}

type PineconeCompatibleMetadata = AppMetadata & RecordMetadata;

// Use Pinecone's types directly
let index: Index;
let contextIndex: Index;

export async function initIndexes() {
  if (!process.env.PINECONE_INDEX) {
    throw new Error('Missing PINECONE_INDEX environment variable');
  }
  
  index = pc.index(process.env.PINECONE_INDEX);
  contextIndex = pc.index(process.env.PINECONE_INDEX);
}

// Create a placeholder vector with a single non-zero value
function createPlaceholderVector() {
  const vector = new Array(VECTOR_DIMENSION).fill(0);
  vector[0] = 1; // Set first element to 1 to ensure non-zero vector
  return vector;
}

// Convert metadata to a format compatible with Pinecone
export function toPineconeMetadata(metadata: Partial<AppMetadata>): Record<string, RecordMetadataValue> {
  const timestamp = Date.now();
  const result: Record<string, RecordMetadataValue> = {
    agentId: metadata.agentId || '',
    userId: metadata.userId || '',
    content: metadata.content || '',
    source: metadata.source || '',
    title: metadata.title || '',
    description: metadata.description || '',
    createdAt: metadata.createdAt || timestamp,
    updatedAt: metadata.updatedAt || timestamp,
  };
  return result;
}

// Convert Pinecone metadata back to our app format
export function fromPineconeMetadata(metadata: Record<string, RecordMetadataValue>): AppMetadata {
  return {
    userId: String(metadata.userId || ''),
    content: String(metadata.content || ''),
    title: String(metadata.title || ''),
    createdAt: Number(metadata.createdAt || Date.now()),
    agentId: metadata.agentId ? String(metadata.agentId) : undefined,
    source: metadata.source ? String(metadata.source) : undefined,
    description: metadata.description ? String(metadata.description) : undefined,
    updatedAt: metadata.updatedAt ? Number(metadata.updatedAt) : undefined,
  };
}

export async function getUserContexts(userId: string): Promise<UserContext[]> {
  if (!contextIndex) await initIndexes();

  const response = await contextIndex.query({
    vector: createPlaceholderVector(),
    filter: { userId },
    topK: 100
  });

  return response.matches.map(match => ({
    id: match.id,
    userId: String(match.metadata?.userId || ''),
    title: String(match.metadata?.title || 'Untitled'),
    description: match.metadata?.description ? String(match.metadata.description) : undefined,
    content: String(match.metadata?.content || ''),
    createdAt: Number(match.metadata?.createdAt || Date.now()),
    updatedAt: Number(match.metadata?.updatedAt || Date.now())
  }));
}

export async function addUserContext(
  userId: string,
  context: {
    title: string;
    description?: string;
    content: string;
  }
): Promise<string> {
  if (!contextIndex) await initIndexes();

  const contextId = `ctx_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  
  await contextIndex.upsert([{
    id: contextId,
    values: createPlaceholderVector(),
    metadata: {
      userId,
      title: context.title,
      description: context.description || '',
      content: context.content,
      createdAt: Date.now()
    }
  }]);

  return contextId;
}

interface AgentConfig {
  name: string;
  description: string;
  category: string;
  useCases?: string;
  triggers?: string[];
  dataAccess?: string;
  isPublic?: boolean;
}

export async function storeAgentWithContext(
  agentId: string,
  config: unknown,
  contextDocuments: Document[],
  selectedContextIds: string[],
  ownerId: string
): Promise<AgentMetadata> {
  if (!index || !contextIndex) await initIndexes();

  const agentConfig = config as AgentConfig;
  
  // Store agent metadata
  const metadata: AgentMetadata = {
    agentId,
    name: agentConfig.name,
    description: agentConfig.description,
    category: agentConfig.category,
    useCases: agentConfig.useCases || '',
    triggers: agentConfig.triggers || [],
    dataAccess: agentConfig.dataAccess?.split(',').map((d: string) => d.trim()) || [],
    isPublic: agentConfig.isPublic || false,
    ownerId,
    userId: ownerId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    selectedContextIds,
    type: 'agent_config'
  };

  // Store agent configuration
  await index.upsert([{
    id: `agent_${agentId}`,
    values: createPlaceholderVector(),
    metadata
  }]);

  // Store context documents if any
  if (contextDocuments.length > 0) {
    const contextVectors: PineconeRecord<PineconeCompatibleMetadata>[] = contextDocuments.map((doc, i) => ({
      id: `${agentId}_context_${i}`,
      values: createPlaceholderVector(),
      metadata: {
        agentId,
        userId: ownerId,
        content: doc.pageContent,
        source: doc.metadata.source,
        title: `Uploaded Context ${i + 1}`,
        createdAt: Date.now()
      }
    }));

    await contextIndex.upsert(contextVectors);
  }

  // Link selected contexts to the agent
  if (selectedContextIds.length > 0) {
    const selectedContexts = await contextIndex.fetch(selectedContextIds);
    const contextVectors: PineconeRecord<PineconeCompatibleMetadata>[] = Object.values(selectedContexts.records)
      .filter((record): record is PineconeRecord<PineconeCompatibleMetadata> => record !== null)
      .map(record => ({
        id: `${agentId}_${record.id}`,
        values: createPlaceholderVector(),
        metadata: {
          ...record.metadata as PineconeCompatibleMetadata,
          agentId
        }
      }));

    if (contextVectors.length > 0) {
      await contextIndex.upsert(contextVectors);
    }
  }

  return metadata;
}

export async function getAgentConfig(agentId: string): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  console.log('Fetching agent with ID:', `agent_${agentId}`);
  const response = await index.fetch([`agent_${agentId}`]);
  console.log('Individual agent fetch response:', JSON.stringify(response.records, null, 2));

  const agent = response.records[`agent_${agentId}`];
  if (!agent) {
    throw new Error('Agent not found');
  }

  console.log('Individual agent metadata:', JSON.stringify(agent.metadata, null, 2));
  return agent.metadata as AgentMetadata;
}

export async function getAgentContext(agentId: string): Promise<Document[]> {
  if (!contextIndex) await initIndexes();

  // Get all context documents for the agent
  const response = await contextIndex.query({
    vector: createPlaceholderVector(),
    filter: { agentId },
    topK: 100
  });

  return response.matches.map(match => new Document({
    pageContent: String(match.metadata?.content || ''),
    metadata: {
      source: match.metadata?.source,
      title: match.metadata?.title
    }
  }));
}

export async function listUserAgents(ownerId: string): Promise<AgentMetadata[]> {
  if (!index) await initIndexes();

  console.log('Listing agents for owner:', ownerId);
  
  // First query to get matching IDs
  const queryResponse = await index.query({
    vector: createPlaceholderVector(),
    filter: { ownerId },
    topK: 100
  });

  // Get IDs from query response
  const agentIds = queryResponse.matches.map(match => match.id);
  
  if (agentIds.length === 0) {
    return [];
  }

  // Fetch full records with metadata
  const response = await index.fetch(agentIds);
  console.log('Fetch response:', JSON.stringify(response.records, null, 2));

  // Map and filter out any invalid records
  const agents = Object.values(response.records)
    .map(record => record?.metadata as AgentMetadata)
    .filter(agent => agent && agent.agentId && agent.name);

  console.log('Filtered agents:', JSON.stringify(agents, null, 2));
  return agents;
}

export async function listPublicAgents(): Promise<AgentMetadata[]> {
  if (!index) await initIndexes();

  // First query to get matching IDs
  const queryResponse = await index.query({
    vector: createPlaceholderVector(),
    filter: { isPublic: true },
    topK: 100
  });

  // Get IDs from query response
  const agentIds = queryResponse.matches.map(match => match.id);
  
  if (agentIds.length === 0) {
    return [];
  }

  // Fetch full records with metadata
  const response = await index.fetch(agentIds);

  // Map and filter out any invalid records
  return Object.values(response.records)
    .map(record => record?.metadata as AgentMetadata)
    .filter(agent => agent && agent.agentId && agent.name);
} 