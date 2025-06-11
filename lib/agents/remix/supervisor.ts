import { RemixState } from "./types";
import { StateGraph } from "./graph";
import { contextAnalyzerAgent } from "./context-analyzer";
import { capabilityMergerAgent } from "./capability-merger";
import { configurationAgent } from "./configuration-agent";

export async function createRemixGraph(initialState: RemixState) {
  const builder = new StateGraph();

  // Add nodes
  builder.addNode("context_analyzer", contextAnalyzerAgent as any);
  builder.addNode("capability_merger", capabilityMergerAgent as any);
  builder.addNode("configuration_agent", configurationAgent as any);

  // Add edges
  builder.addEdge("START", "context_analyzer");
  builder.addEdge("context_analyzer", "capability_merger");
  builder.addEdge("capability_merger", "configuration_agent");
  builder.addEdge("configuration_agent", "END");

  // Compile the graph
  const graph = builder.compile();

  // Run the graph with initial state
  return await graph.invoke(initialState);
}

export async function remixAgents(agents: RemixState['parentAgents']) {
  // Initialize state
  const initialState: RemixState = {
    parentAgents: agents,
    messages: [],
    context: {
      analyzedContexts: [],
      mergedContextIds: []
    },
    capabilities: {
      analyzedCapabilities: [],
      mergedCapabilities: []
    },
    configuration: {
      name: "",
      description: "",
      category: "",
      triggers: [],
      isPublic: false
    }
  };

  try {
    // Run the graph
    const finalState = await createRemixGraph(initialState);

    // Return the final configuration
    return {
      ...(finalState as RemixState).configuration,
      parentAgents: agents.map(a => a.agentId),
      selectedContextIds: (finalState as RemixState).context.mergedContextIds
    };
  } catch (_error) {
    console.error("Error in remixAgents:", _error);
    throw _error;
  }
} 