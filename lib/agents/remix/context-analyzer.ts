import { Message } from "ai";
import { ContextAnalysis, RemixState } from "./types";
import { Command } from "./graph";
import { initializeGeminiModel } from "@/app/utils/modelInit";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

export async function contextAnalyzerAgent(state: RemixState): Promise<Command> {
  const model = await initializeGeminiModel({
    maxOutputTokens: 2048,
    temperature: 0.7
  });

  const analyzedContexts: ContextAnalysis[] = [];

  // Analyze each parent agent's context
  for (const agent of state.parentAgents) {
    const prompt = new PromptTemplate({
      template: `
      Analyze the following agent's context and capabilities:
      Agent Name: {name}
      Description: {description}
      Category: {category}
      Use Cases: {useCases}
      Context IDs: {contextIds}

      Provide a detailed analysis including:
      1. Summary of the agent's knowledge domain
      2. Main areas of expertise
      3. Potential overlaps with other agents in the system
      4. Unique capabilities and knowledge areas

      Format the response as a structured analysis that can be parsed.
      `,
      inputVariables: ['name', 'description', 'category', 'useCases', 'contextIds']
    });

    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const analysis = await chain.invoke({
      name: agent.name,
      description: agent.description,
      category: agent.category,
      useCases: agent.useCases,
      contextIds: agent.selectedContextIds?.join(", ") || "none"
    });

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