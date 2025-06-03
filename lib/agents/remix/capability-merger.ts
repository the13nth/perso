import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message } from "ai";
import { CapabilityAnalysis, RemixState, Agent } from "./types";
import { Command } from "./graph";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set in environment variables");
}

// Initialize model with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function capabilityMergerAgent(state: RemixState): Promise<Command> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const analyzedCapabilities: CapabilityAnalysis[] = [];

  // Analyze each parent agent's capabilities
  for (const agent of state.parentAgents) {
    const prompt = `
      Analyze the following agent's capabilities and triggers:
      Agent Name: ${agent.name}
      Description: ${agent.description}
      Category: ${agent.category}
      Use Cases: ${agent.useCases}
      Triggers: ${agent.triggers.join(", ")}

      Context Analysis: ${state.context.analyzedContexts.find(a => a.agentId === agent.agentId)?.summary}

      Provide a detailed analysis including:
      1. List of core capabilities
      2. Specialized functions
      3. Potential synergies with other agents
      4. Unique strengths and limitations

      Format the response as a structured analysis that can be parsed.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysis = response.text();

    // Find complementary capabilities with other agents
    const complementary = state.parentAgents
      .filter(other => other.agentId !== agent.agentId)
      .map(other => ({
        withAgentId: other.agentId,
        sharedCapabilities: findSharedCapabilities(agent, other)
      }));

    analyzedCapabilities.push({
      agentId: agent.agentId,
      capabilities: extractCapabilities(analysis),
      triggers: agent.triggers,
      specializations: extractSpecializations(analysis),
      complementary
    });
  }

  // Generate merged capabilities using Gemini
  const mergePrompt = `
    Based on the following capability analyses, suggest an optimal way to combine these agents' capabilities:
    ${analyzedCapabilities.map(ac => `
      Agent: ${state.parentAgents.find(a => a.agentId === ac.agentId)?.name}
      Capabilities: ${ac.capabilities.join(", ")}
      Specializations: ${ac.specializations.join(", ")}
    `).join("\n")}

    Provide:
    1. A list of merged capabilities that leverages synergies
    2. How the capabilities complement each other
    3. Any potential conflicts or limitations to be aware of

    Format the response as a structured list of capabilities.
  `;

  const mergeResult = await model.generateContent(mergePrompt);
  const mergeResponse = await mergeResult.response;
  const mergedCapabilities = extractCapabilities(mergeResponse.text());

  // Update state with analysis results
  return Command({
    goto: "configuration_agent",
    update: {
      capabilities: {
        analyzedCapabilities,
        mergedCapabilities
      },
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "Capability analysis and merger completed. Moving to configuration.",
          name: "capability_merger"
        } as Message
      ]
    }
  });
}

function findSharedCapabilities(agent1: Agent, agent2: Agent): string[] {
  // In practice, you'd want more sophisticated capability matching
  const capabilities1 = new Set(agent1.triggers);
  return agent2.triggers.filter((t: string) => capabilities1.has(t));
}

function extractCapabilities(analysis: string): string[] {
  // Simple extraction - in practice you'd want more sophisticated parsing
  const capabilities = analysis
    .split("\n")
    .filter(line => line.includes("capability") || line.includes("function"))
    .map(line => line.trim());
  
  return capabilities;
}

function extractSpecializations(analysis: string): string[] {
  // Simple extraction - in practice you'd want more sophisticated parsing
  const specializations = analysis
    .split("\n")
    .filter(line => line.includes("specialized") || line.includes("unique"))
    .map(line => line.trim());
  
  return specializations;
} 