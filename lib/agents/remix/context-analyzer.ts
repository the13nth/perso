import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message } from "ai";
import { ContextAnalysis, RemixState } from "./types";
import { Command } from "./graph";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set ind environment variables");
}

// Initialize model with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function contextAnalyzerAgent(state: RemixState): Promise<Command> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const analyzedContexts: ContextAnalysis[] = [];

  // Analyze each parent agent's context
  for (const agent of state.parentAgents) {
    const prompt = `
      Analyze the following agent's context and capabilities:
      Agent Name: ${agent.name}
      Description: ${agent.description}
      Category: ${agent.category}
      Use Cases: ${agent.useCases}
      Context IDs: ${agent.selectedContextIds?.join(", ") || "none"}

      Provide a detailed analysis including:
      1. Summary of the agent's knowledge domain
      2. Main areas of expertise
      3. Potential overlaps with other agents in the system
      4. Unique capabilities and knowledge areas

      Format the response as a structured analysis that can be parsed.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    // Find overlaps with other agents
    const overlaps = state.parentAgents
      .filter(other => other.agentId !== agent.agentId)
      .map(other => ({
        withAgentId: other.agentId,
        sharedContexts: (agent.selectedContextIds || [])
          .filter(id => other.selectedContextIds?.includes(id)) || []
      }));

    analyzedContexts.push({
      agentId: agent.agentId,
      contextIds: agent.selectedContextIds || [],
      summary: analysis,
      domains: extractDomains(analysis),
      overlaps
    });
  }

  // Update state with analysis results
  return Command({
    goto: "capability_merger",
    update: {
      context: {
        ...state.context,
        analyzedContexts
      },
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "Context analysis completed. Moving to capability analysis.",
          name: "context_analyzer"
        } as Message
      ]
    }
  });
}

function extractDomains(analysis: string): string[] {
  // Simple extraction - in practice you'd want more sophisticated parsing
  const domains = analysis
    .split("\n")
    .filter(line => line.includes("expertise") || line.includes("domain"))
    .map(line => line.trim());
  
  return domains;
} 