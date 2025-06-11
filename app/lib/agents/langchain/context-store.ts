import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY");
}

if (!process.env.PINECONE_ENVIRONMENT) {
  throw new Error("Missing PINECONE_ENVIRONMENT");
}

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("Missing GOOGLE_API_KEY");
}

// Initialize Pinecone client
const client = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Initialize embeddings model
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  modelName: "embedding-001",
});

let store: PineconeStore | null = null;

async function initStore() {
  if (store) return store;

  const pineconeIndex = client.Index("langchain");

  store = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });

  return store;
}

export interface AgentContext {
  agentId: string;
  content: string;
  source?: string;
  title?: string;
  score?: number;
}

interface Context {
  title?: string;
  content: string;
  source?: string;
  score?: number;
}

// In-memory context store
const contextStore = new Map<string, Context[]>();

export async function storeAgentContext(
  agentId: string,
  contexts: Context[]
): Promise<void> {
  try {
    console.log('[DEBUG] Storing context for agent:', agentId);
    console.log('[DEBUG] Context count:', contexts.length);

    // Get existing contexts or initialize new array
    const existingContexts = contextStore.get(agentId) || [];

    // Add new contexts
    const updatedContexts = [...existingContexts, ...contexts];
    contextStore.set(agentId, updatedContexts);

    console.log('[DEBUG] Successfully stored context');
    console.log('[DEBUG] Total contexts for agent:', updatedContexts.length);
  } catch (_error) {
    console.error('[ERROR] Failed to store context:', _error);
    throw _error;
  }
}

export async function getAgentContext(
  agentId: string,
  query?: string
): Promise<Context[]> {
  try {
    console.log('[DEBUG] Getting context for agent:', agentId);
    console.log('[DEBUG] Query:', query);

    // Get contexts for this agent
    const contexts = contextStore.get(agentId) || [];
    console.log('[DEBUG] Found contexts:', contexts.length);

    if (!query) {
      return contexts;
    }

    // If query provided, score contexts by relevance
    const scoredContexts = contexts.map(ctx => {
      const content = ctx.content.toLowerCase();
      const queryTerms = query.toLowerCase().split(/\W+/);
      
      // Simple relevance scoring
      let score = 0;
      queryTerms.forEach(term => {
        if (term.length > 2 && content.includes(term)) {
          score += 1;
        }
      });

      // Normalize score
      score = score / queryTerms.length;

      return {
        ...ctx,
        score
      };
    });

    // Sort by score and filter low relevance
    const relevantContexts = scoredContexts
      .filter(ctx => ctx.score > 0.1)
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log('[DEBUG] Returning relevant contexts:', relevantContexts.length);
    return relevantContexts;
  } catch (_error) {
    console.error('[ERROR] Failed to get context:', _error);
    throw _error;
  }
}

export async function clearAgentContext(agentId: string): Promise<void> {
  try {
    console.log('[DEBUG] Clearing context for agent:', agentId);
    contextStore.delete(agentId);
    console.log('[DEBUG] Successfully cleared context');
  } catch (_error) {
    console.error('[ERROR] Failed to clear context:', _error);
    throw _error;
  }
}

export async function deleteAgentContext(agentId: string): Promise<void> {
  try {
    const vectorStore = await initStore();
    await vectorStore.delete({ filter: { agentId } });
    console.log(`[INFO] Deleted all contexts for agent ${agentId}`);
  } catch (_error) {
    console.error('[ERROR] Failed to delete agent context:', _error);
    throw new Error('Failed to delete agent context');
  }
} 