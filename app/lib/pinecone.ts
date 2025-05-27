import { Pinecone, type RecordMetadataValue } from "@pinecone-database/pinecone";
import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from "@langchain/pinecone";

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

export const agentsIndex = pinecone.Index(process.env.PINECONE_INDEX!);

// Define base metadata types that conform to Pinecone's requirements
type BaseMetadata = {
  text: string;
  userId: string;
  type: string;
  title?: string;
  source?: string;
  access?: string;
  createdAt: string;
};

// Document specific metadata
interface DocumentMetadata extends BaseMetadata {
  categories: string[];
}

// Agent specific metadata
export interface AgentMetadata extends BaseMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  tools: string[];
  isPublic: boolean;
  ownerId: string;
}

interface PineconeDocument extends Document {
  metadata: DocumentMetadata & {
    id: string;
    vector: number[];
  };
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

export async function storeAgentWithContext(
  agentId: string,
  agentConfig: AgentMetadata,
  contextDocuments: Document[],
  ownerId: string
) {
  // Store agent configuration
  const agentMetadata: AgentMetadata = {
    agentId,
    name: agentConfig.name,
    description: agentConfig.description,
    category: agentConfig.category,
    isPublic: agentConfig.isPublic,
    ownerId,
    createdAt: new Date().toISOString(),
    capabilities: agentConfig.capabilities || [],
    tools: agentConfig.tools || [],
    text: agentConfig.description || "",
    userId: ownerId,
    type: "agent_config"
  };

  // Store agent configuration as a special document
  await PineconeStore.fromDocuments(
    [
      new Document({
        pageContent: JSON.stringify(agentConfig),
        metadata: {
          ...agentMetadata,
          type: 'agent_config',
        },
      }),
    ],
    embeddings,
    {
      pineconeIndex: agentsIndex,
    }
  );

  // Store context documents
  if (contextDocuments.length > 0) {
    await PineconeStore.fromDocuments(
      contextDocuments.map(doc => ({
        ...doc,
        metadata: {
          ...doc.metadata,
          agentId,
          type: 'context',
        },
      })),
      embeddings,
      {
        pineconeIndex: agentsIndex,
      }
    );
  }

  return agentMetadata;
}

export async function getAgentConfig(agentId: string): Promise<AgentMetadata | null> {
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "embedding-001",
  });

  const index = pinecone.index(process.env.PINECONE_INDEX!);
  const queryVector = await embeddings.embedQuery(agentId);

  const queryResponse = await index.query({
    vector: queryVector,
    filter: { agentId, type: "agent_config" },
    topK: 1,
    includeMetadata: true
  });

  if (!queryResponse.matches?.length) {
    return null;
  }

  const metadata = queryResponse.matches[0].metadata as unknown as AgentMetadata;
  return metadata;
}

export async function getAgentContext(agentId: string, query: string) {
  const vectorStore = await PineconeStore.fromExistingIndex(
    embeddings,
    { pineconeIndex: agentsIndex }
  );

  return await vectorStore.similaritySearch(query, 5, {
    agentId,
    type: 'context',
  });
}

export async function listPublicAgents() {
  const queryVector = await embeddings.embedQuery("public agents");
  const queryResponse = await agentsIndex.query({
    vector: queryVector,
    filter: { type: 'agent_config', isPublic: true },
    topK: 100,
    includeMetadata: true
  });

  return queryResponse.matches.map(match => match.metadata as unknown as AgentMetadata);
}

export async function listUserAgents(ownerId: string) {
  const queryVector = await embeddings.embedQuery(ownerId);
  const queryResponse = await agentsIndex.query({
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
      capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities : [],
      tools: Array.isArray(metadata.tools) ? metadata.tools : [],
      isPublic: Boolean(metadata.isPublic),
      ownerId: String(metadata.ownerId || ""),
      text: String(metadata.text || ""),
      userId: String(metadata.userId || ""),
      type: String(metadata.type || ""),
      createdAt: String(metadata.createdAt || new Date().toISOString()),
      score: match.score || 0
    } as AgentMetadata;
  });
}

export async function getAgentConfigV6(agentId: string): Promise<AgentMetadata | null> {
  const index = pinecone.index(process.env.PINECONE_INDEX!);

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