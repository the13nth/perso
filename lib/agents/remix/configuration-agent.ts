import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message } from "ai";
import { RemixState } from "./types";
import { Command } from "./graph";

if (!process.env.GOOGLE_API_KEY) {
  throw new Error("GOOGLE_API_KEY is not set in environment variables");
}

// Initialize model with API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function configurationAgent(state: RemixState): Promise<Command> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // Generate configuration using Gemini
  const configPrompt = `
    Based on the following analyses, generate an optimal configuration for a super agent that combines these agents:

    Parent Agents:
    ${state.parentAgents.map(agent => `
      Name: ${agent.name}
      Description: ${agent.description}
      Category: ${agent.category}
      Use Cases: ${agent.useCases}
      Triggers: ${agent.triggers.join(", ")}
    `).join("\n")}

    Context Analysis:
    ${state.context.analyzedContexts.map(ac => `
      Agent: ${state.parentAgents.find(a => a.agentId === ac.agentId)?.name}
      Domains: ${ac.domains.join(", ")}
      Summary: ${ac.summary}
    `).join("\n")}

    Capability Analysis:
    ${state.capabilities.analyzedCapabilities.map(ac => `
      Agent: ${state.parentAgents.find(a => a.agentId === ac.agentId)?.name}
      Capabilities: ${ac.capabilities.join(", ")}
      Specializations: ${ac.specializations.join(", ")}
    `).join("\n")}

    Merged Capabilities:
    ${state.capabilities.mergedCapabilities.join("\n")}

    Generate a configuration that includes:
    1. A descriptive name that reflects the combined capabilities
    2. A comprehensive description of the super agent's abilities
    3. The most appropriate category based on the combined focus areas
    4. A complete list of triggers that covers all use cases
    5. Whether this agent should be public or private (based on parent agents)

    Format the response as a structured configuration that can be parsed.
  `;

  const result = await model.generateContent(configPrompt);
  const response = await result.response;
  const config = parseConfiguration(response.text());

  // Determine if the super agent should be public
  const shouldBePublic = state.parentAgents.every(agent => agent.isPublic);

  // Update state with final configuration
  return Command({
    goto: "END",
    update: {
      configuration: {
        ...config,
        isPublic: shouldBePublic
      },
      messages: [
        ...state.messages,
        {
          role: "assistant",
          content: "Configuration generated. Super agent ready for creation.",
          name: "configuration_agent"
        } as Message
      ]
    }
  });
}

function parseConfiguration(configText: string): {
  name: string;
  description: string;
  category: string;
  triggers: string[];
} {
  // Simple parsing - in practice you'd want more sophisticated parsing
  const lines = configText.split("\n");
  
  return {
    name: lines.find(l => l.toLowerCase().includes("name:"))?.split(":")[1]?.trim() || "Super Agent",
    description: lines.find(l => l.toLowerCase().includes("description:"))?.split(":")[1]?.trim() || "",
    category: lines.find(l => l.toLowerCase().includes("category:"))?.split(":")[1]?.trim() || "Other",
    triggers: lines
      .filter(l => l.toLowerCase().includes("trigger:"))
      .map(l => l.split(":")[1]?.trim())
      .filter((t): t is string => !!t)
  };
} 