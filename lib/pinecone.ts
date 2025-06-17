import { Pinecone, Index, RecordMetadata, PineconeRecord, RecordMetadataValue } from '@pinecone-database/pinecone';
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
  
  index = pinecone.index(process.env.PINECONE_INDEX!);
  contextIndex = pinecone.index(process.env.PINECONE_INDEX!);
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

async function embedAgent(agentConfig: AgentConfig): Promise<number[]> {
  // Combine all relevant agent data into a single text for embedding
  const agentText = [
    agentConfig.name,
    agentConfig.description,
    agentConfig.category,
    agentConfig.useCases,
    agentConfig.triggers?.join(", "),
  ].filter(Boolean).join("\n");

  // Generate embedding for the combined text
  const [embedding] = await embeddings.embedDocuments([agentText]);
  return embedding;
}

export async function storeAgentWithContext(
  agentId: string,
  config: unknown,
  _contextDocuments: Document[],
  selectedContextIds: string[],
  ownerId: string
): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  const agentConfig = config as AgentConfig;
  
  // Generate embedding for the agent
  const embedding = await embedAgent(agentConfig);

  // Prepare metadata
  const metadata: AgentMetadata = {
    agentId,
    name: agentConfig.name,
    description: agentConfig.description,
    category: agentConfig.category,
    useCases: agentConfig.useCases || '',
    triggers: agentConfig.triggers || [],
    dataAccess: agentConfig.dataAccess ? [agentConfig.dataAccess] : [],
    isPublic: agentConfig.isPublic || false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    userId: ownerId,
    ownerId,
    selectedContextIds,
    type: 'agent_config'
  };

  // Store agent with prefixed ID
  const prefixedAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
  await index.upsert([{
    id: prefixedAgentId,
    values: embedding,
    metadata
  }]);

  return metadata;
}

export async function getAgentConfig(agentId: string): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  // Only add agent_ prefix if it doesn't already exist
  const fullAgentId = agentId.startsWith('agent_') ? agentId : `agent_${agentId}`;
  
  console.log('Fetching agent with ID:', fullAgentId);
  console.log('Using Pinecone index:', process.env.PINECONE_INDEX);
  
  // Try both with and without prefix
  const response = await index.fetch([fullAgentId, agentId]);
  console.log('Individual agent fetch response:', JSON.stringify(response.records, null, 2));

  // Check both prefixed and unprefixed IDs
  const agent = response.records[fullAgentId] || response.records[agentId];
  if (!agent) {
    console.log('Agent not found with either ID format. Trying query...');
    // Try querying instead of direct fetch
    const queryResponse = await index.query({
      vector: createPlaceholderVector(),
      filter: { 
        $and: [
          { agentId: { $in: [agentId, fullAgentId] } },
          { type: 'agent_config' }
        ]
      },
      topK: 1
    });
    console.log('Query response:', JSON.stringify(queryResponse.matches, null, 2));
    
    if (queryResponse.matches.length > 0) {
      const metadata = queryResponse.matches[0].metadata as AgentMetadata;
      // Remove prefix if it exists
      metadata.agentId = metadata.agentId.replace('agent_', '');
      return metadata;
    }
    throw new Error('Agent not found');
  }

  // Ensure the returned metadata has the unprefixed agentId for consistency
  const metadata = agent.metadata as AgentMetadata;
  metadata.agentId = metadata.agentId.replace('agent_', '');
  
  console.log('Individual agent metadata:', JSON.stringify(metadata, null, 2));
  return metadata;
}

export async function updateAgentConfig(
  agentId: string, 
  updates: Partial<AgentMetadata>
): Promise<AgentMetadata> {
  if (!index) await initIndexes();

  // Get current agent configuration
  const currentAgent = await getAgentConfig(agentId);
  
  // Merge updates with current configuration
  const updatedMetadata: AgentMetadata = {
    ...currentAgent,
    ...updates,
    agentId, // Ensure agentId doesn't change
    ownerId: currentAgent.ownerId, // Ensure ownership doesn't change
    createdAt: currentAgent.createdAt, // Preserve creation date
    updatedAt: Date.now(), // Update timestamp
    type: 'agent_config' // Ensure type stays consistent
  };

  // Generate new embedding for updated configuration
  const configEmbedding = await embeddings.embedQuery(
    `${updatedMetadata.name} ${updatedMetadata.description} ${updatedMetadata.useCases || ''}`
  );

  // Update the agent configuration in Pinecone
  await index.upsert([{
    id: `agent_${agentId}`,
    values: configEmbedding,
    metadata: updatedMetadata
  }]);

  // If selectedContextIds changed, update context linking
  if (updates.selectedContextIds && contextIndex) {
    // Remove old context links (if any)
    const oldContextLinks = await contextIndex.query({
      vector: createPlaceholderVector(),
      filter: { agentId: agentId },
      topK: 1000
    });

    if (oldContextLinks.matches.length > 0) {
      const idsToDelete = oldContextLinks.matches
        .filter(match => match.id.startsWith(`${agentId}_`) && !match.id.includes('_context_'))
        .map(match => match.id);
      
      if (idsToDelete.length > 0) {
        await contextIndex.deleteMany(idsToDelete);
      }
    }

    // Link new selected contexts
    if (updates.selectedContextIds.length > 0) {
      const selectedContexts = await contextIndex.fetch(updates.selectedContextIds);
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
  }

  return updatedMetadata;
}

export async function getAgentContext(agentId: string, query?: string): Promise<Document[]> {
  if (!contextIndex) await initIndexes();

  console.log(`[Pinecone] Getting context for agent: ${agentId}`);
  
  // Get agent config to get selectedContextIds
  const agentConfig = await getAgentConfig(agentId);
  console.log(`[Pinecone] Agent config:`, {
    selectedContextIds: agentConfig.selectedContextIds,
    category: agentConfig.category
  });

  // First, list all available categories in Pinecone
  console.log('[Pinecone] Starting categories check...');
  console.log('[Pinecone] Query filter:', {
    $and: [
      { type: "document" },
      { categories: { $exists: true } }
    ]
  });

  const categoriesCheck = await contextIndex.query({
    vector: createPlaceholderVector(),
    filter: { 
      $and: [
        { type: "document" },  // Only look at actual documents
        { categories: { $exists: true } }  // Must have categories field
      ]
    },
    topK: 10000,
    includeMetadata: true
  });

  console.log('[Pinecone] Categories check response:', {
    totalMatches: categoriesCheck.matches?.length || 0,
    sampleMatch: categoriesCheck.matches?.[0] ? {
      id: categoriesCheck.matches[0].id,
      type: categoriesCheck.matches[0].metadata?.type,
      categories: categoriesCheck.matches[0].metadata?.categories
    } : 'No matches'
  });

  // Extract unique categories
  const uniqueCategories = new Set<string>();
  categoriesCheck.matches?.forEach(match => {
    // Check array categories
    if (Array.isArray(match.metadata?.categories)) {
      match.metadata.categories.forEach(cat => uniqueCategories.add(String(cat)));
    }
    // Check single category field
    if (match.metadata?.category) {
      uniqueCategories.add(String(match.metadata.category));
    }
  });

  console.log('[Pinecone] Available categories:', {
    count: uniqueCategories.size,
    categories: Array.from(uniqueCategories),
    documents: categoriesCheck.matches?.map(match => ({
      id: match.id,
      type: match.metadata?.type,
      categories: match.metadata?.categories,
      textPreview: typeof match.metadata?.text === 'string' 
        ? match.metadata.text.substring(0, 100) + '...' 
        : 'No text available'
    }))
  });

  // Get embeddings for the query
  console.log(`[Pinecone] Generating embedding for query: ${query}`);
  const queryVector = query 
    ? await embeddings.embedQuery(query)
    : await embeddings.embedQuery("general context");

  // Query for documents matching our categories
  console.log('[Pinecone] Querying with category filter:', {
    filter: {
      $and: [
        { type: "document" },
        { categories: { $in: agentConfig.selectedContextIds || [] } }
      ]
    }
  });

  const queryResponse = await contextIndex.query({
    vector: queryVector,
    filter: {
      $and: [
        { type: "document" },  // Only get actual documents
        { categories: { $in: agentConfig.selectedContextIds || [] } }  // Match any of our categories
      ]
    },
    topK: 10,
    includeMetadata: true
  });

  console.log(`[Pinecone] Found ${queryResponse.matches?.length || 0} matches with filter`);
  
  // Log each match for debugging
  queryResponse.matches?.forEach((match, i) => {
    const text = match.metadata?.text;
    console.log(`[Pinecone] Match ${i + 1}:`, {
      id: match.id,
      score: match.score,
      categories: match.metadata?.categories,
      type: match.metadata?.type,
      textPreview: typeof text === 'string' ? text.substring(0, 100) + '...' : 'No text available'
    });
  });

  // Convert matches to Documents
  return (queryResponse.matches || []).map(match => {
    return new Document({
      pageContent: String(match.metadata?.text || ''),
      metadata: {
        ...match.metadata,
        score: match.score
      }
    });
  });
}

export async function listUserAgents(ownerId: string): Promise<AgentMetadata[]> {
  if (!index) await initIndexes();

  console.log('Listing agents for owner:', ownerId);
  
  // First query to get matching IDs
  const queryResponse = await index.query({
    vector: createPlaceholderVector(),
    filter: { 
      $and: [
        { ownerId },
        { type: 'agent_config' }
      ]
    },
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

  // Map and filter out any invalid records, ensure consistent agentId format
  const agents = Object.values(response.records)
    .map(record => {
      if (!record?.metadata) return null;
      const metadata = record.metadata as AgentMetadata;
      // Remove agent_ prefix from agentId for consistency
      metadata.agentId = metadata.agentId.replace('agent_', '');
      return metadata;
    })
    .filter((agent): agent is AgentMetadata => agent !== null && !!agent.agentId && !!agent.name);

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