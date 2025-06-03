export interface Command {
  goto: string;
  update: Record<string, unknown>;
}

export function Command(options: Command): Command {
  return options;
}

export interface GraphState {
  [key: string]: unknown;
}

export class StateGraph {
  private nodes: Map<string, (state: GraphState) => Promise<Command>> = new Map();
  private edges: Map<string, string[]> = new Map();

  constructor() {
    this.edges.set("START", []);
    this.edges.set("END", []);
  }

  addNode(name: string, handler: (state: GraphState) => Promise<Command>) {
    this.nodes.set(name, handler);
    this.edges.set(name, []);
    return this;
  }

  addEdge(from: string, to: string) {
    const edges = this.edges.get(from) || [];
    edges.push(to);
    this.edges.set(from, edges);
    return this;
  }

  compile() {
    return {
      invoke: async (initialState: GraphState) => {
        let currentState = initialState;
        let currentNode = "START";
        
        while (currentNode !== "END") {
          const edges = this.edges.get(currentNode);
          if (!edges || edges.length === 0) {
            throw new Error(`No edges found for node ${currentNode}`);
          }

          const nextNode = edges[0]; // In our case, we only have one edge per node
          if (nextNode === "END") {
            break;
          }

          const handler = this.nodes.get(nextNode);
          if (!handler) {
            throw new Error(`No handler found for node ${nextNode}`);
          }

          const result = await handler(currentState);
          currentState = {
            ...currentState,
            ...result.update
          };
          currentNode = result.goto;
        }

        return currentState;
      }
    };
  }
} 