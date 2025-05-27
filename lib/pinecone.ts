import { Pinecone, Index, RecordMetadata, PineconeRecord } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Vector dimension must match the Pinecone index dimension
const VECTOR_DIMENSION = 768;

export interface AgentMetadata extends RecordMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  useCases: string;
  triggers: string[];
  dataAccess: string[];
  isPublic: boolean;
  ownerId: string;
  createdAt: number;
  selectedContextIds?: string[];
  [key: string]: any;
}

export interface ContextMetadata extends RecordMetadata {
  agentId?: string;
  userId: string;
  content: string;
  source?: string;
  title: string;
  description?: string;
  createdAt: number;
  [key: string]: any;
}

export interface UserContext {
  id: string;
  title: string;
  description?: string;
  content: string;
  createdAt: number;
}

let index: Index<AgentMetadata>;
let contextIndex: Index<ContextMetadata>;

export async function initIndexes() {
  if (!process.env.PINECONE_INDEX) {
    throw new Error('Missing PINECONE_INDEX environment variable');
  }
  
  index = pc.index<AgentMetadata>(process.env.PINECONE_INDEX);
  contextIndex = pc.index<ContextMetadata>(process.env.PINECONE_INDEX);
}

export async function getUserContexts(userId: string): Promise<UserContext[]> {
  if (!contextIndex) await initIndexes();

  const response = await contextIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    filter: { userId },
    topK: 100
  });

  return response.matches.map(match => ({
    id: match.id,
    title: match.metadata?.title || 'Untitled',
    description: match.metadata?.description,
    content: match.metadata?.content || '',
    createdAt: match.metadata?.createdAt || Date.now()
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
    values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    metadata: {
      userId,
      title: context.title,
      description: context.description,
      content: context.content,
      createdAt: Date.now()
    }
  }]);

  return contextId;
}

export async function storeAgentWithContext(
  agentId: string,
  config: any,
  contextDocuments: Document[],
  selectedContextIds: string[],
  ownerId: string
): Promise<AgentMetadata> {
  if (!index || !contextIndex) await initIndexes();

  // Store agent metadata
  const metadata: AgentMetadata = {
    agentId,
    name: config.name,
    description: config.description,
    category: config.category,
    useCases: config.useCases,
    triggers: config.triggers?.split(',').map((t: string) => t.trim()) || [],
    dataAccess: config.dataAccess?.split(',').map((d: string) => d.trim()) || [],
    isPublic: config.isPublic || false,
    ownerId,
    createdAt: Date.now(),
    selectedContextIds
  };

  // Store agent configuration
  await index.upsert([{
    id: `agent_${agentId}`,
    values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    metadata
  }]);

  // Store context documents if any
  if (contextDocuments.length > 0) {
    const contextVectors: PineconeRecord<ContextMetadata>[] = contextDocuments.map((doc, i) => ({
      id: `${agentId}_context_${i}`,
      values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
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
    const contextVectors: PineconeRecord<ContextMetadata>[] = Object.values(selectedContexts.records)
      .filter((record): record is PineconeRecord<ContextMetadata> => record !== null)
      .map(record => ({
        id: `${agentId}_${record.id}`,
        values: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
        metadata: {
          ...record.metadata as ContextMetadata,
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

  const response = await index.fetch([`agent_${agentId}`]);

  const agent = response.records[`agent_${agentId}`];
  if (!agent) {
    throw new Error('Agent not found');
  }

  return agent.metadata as AgentMetadata;
}

export async function getAgentContext(agentId: string, query: string): Promise<Document[]> {
  if (!contextIndex) await initIndexes();

  // Get all context documents for the agent
  const response = await contextIndex.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    filter: { agentId },
    topK: 100
  });

  return response.matches.map(match => new Document({
    pageContent: match.metadata?.content || '',
    metadata: {
      source: match.metadata?.source,
      title: match.metadata?.title
    }
  }));
}

export async function listPublicAgents(): Promise<AgentMetadata[]> {
  if (!index) await initIndexes();

  const response = await index.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    filter: { isPublic: true },
    topK: 100
  });

  return response.matches.map(match => match.metadata as AgentMetadata);
}

export async function listUserAgents(ownerId: string): Promise<AgentMetadata[]> {
  if (!index) await initIndexes();

  const response = await index.query({
    vector: new Array(VECTOR_DIMENSION).fill(0), // Placeholder vector
    filter: { ownerId },
    topK: 100
  });

  return response.matches.map(match => match.metadata as AgentMetadata);
} 