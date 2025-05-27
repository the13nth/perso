import { Pinecone } from '@pinecone-database/pinecone';
import { Document } from 'langchain/document';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';

if (!process.env.PINECONE_API_KEY) {
  throw new Error('Missing PINECONE_API_KEY environment variable');
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error('Missing PINECONE_ENVIRONMENT environment variable');
}

if (!process.env.PINECONE_INDEX) {
  throw new Error('Missing PINECONE_INDEX environment variable');
}

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
  environment: process.env.PINECONE_ENVIRONMENT,
});

export const agentsIndex = pinecone.Index(process.env.PINECONE_INDEX);

// Initialize Gemini embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: "embedding-001", // Gemini's text embedding model
});

export interface AgentMetadata {
  agentId: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export async function storeAgentWithContext(
  agentId: string,
  agentConfig: any,
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
    updatedAt: new Date().toISOString(),
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

export async function getAgentConfig(agentId: string): Promise<any> {
  const queryResponse = await agentsIndex.query({
    filter: { agentId, type: 'agent_config' },
    topK: 1,
  });

  if (queryResponse.matches.length === 0) {
    throw new Error(`Agent ${agentId} not found`);
  }

  return JSON.parse(queryResponse.matches[0].metadata.pageContent);
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
  const queryResponse = await agentsIndex.query({
    filter: { type: 'agent_config', isPublic: true },
    topK: 100,
  });

  return queryResponse.matches.map(match => match.metadata as AgentMetadata);
}

export async function listUserAgents(ownerId: string) {
  const queryResponse = await agentsIndex.query({
    filter: { type: 'agent_config', ownerId },
    topK: 100,
  });

  return queryResponse.matches.map(match => match.metadata as AgentMetadata);
} 