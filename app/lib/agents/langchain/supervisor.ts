import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentConfig, AgentMessage, SuperAgentConfig } from "./types";
import { createSuperAgent } from "./capability-merger";
import { getAgentContext } from "./context-store";

// Initialize model with API key
const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.0-flash",
  maxOutputTokens: 2048,
  temperature: 0.7,
  topK: 40,
  topP: 0.95
});



const RoutingSchema = z.object({
  message: z.string(),
  capabilities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.number()
  }))
});

class MessageRoutingTool extends StructuredTool {
  name = "route_message";
  description = "Route a message to the appropriate agent capabilities";
  schema = RoutingSchema;

  async _call(input: z.infer<typeof RoutingSchema>) {
    const { message, capabilities } = input;
    
    const scoredCapabilities = capabilities.map(cap => ({
      ...cap,
      score: cap.priority + message.toLowerCase().split(/\W+/)
        .filter(word => word.length > 2)
        .filter(word => (cap.name + " " + cap.description).toLowerCase().includes(word))
        .length
    }));
    
    const bestMatch = scoredCapabilities.sort((a, b) => b.score - a.score)[0];
    
    return JSON.stringify({
      selectedCapability: bestMatch.name,
      reason: `Selected ${bestMatch.name} (score: ${bestMatch.score}) based on message content and capability priority`
    });
  }
}

const messageRoutingTool = new MessageRoutingTool();

export class AgentSupervisor {
  private superAgent: SuperAgentConfig | null = null;
  private messageHistory: AgentMessage[] = [];
  private initializationPromise: Promise<void>;
  private initialized = false;

  constructor(parentAgents: AgentConfig[]) {
    console.log('[DEBUG] Initializing AgentSupervisor with parent agents:', parentAgents);
    this.initializationPromise = this.initialize(parentAgents).then(() => {
      this.initialized = true;
    }).catch(error => {
      console.error('[ERROR] Failed to initialize supervisor:', error);
      throw error;
    });
  }

  private async initialize(parentAgents: AgentConfig[]) {
    try {
      console.log('[DEBUG] Starting initialization');
      
      // Create super agent
      this.superAgent = await createSuperAgent(parentAgents);
      console.log('[DEBUG] Created super agent:', {
        name: this.superAgent.name,
        capabilities: this.superAgent.mergedCapabilities.map(c => c.name)
      });

      // Initialize message history
      this.messageHistory = [];
    } catch (error) {
      console.error('[ERROR] Failed to initialize supervisor:', error);
      throw error;
    }
  }

  async processMessage(message: string): Promise<{
    response: string;
    contexts: Array<{
      title?: string;
      content: string;
      source?: string;
      score?: number;
    }>;
  }> {
    try {
      // Wait for initialization to complete
      if (!this.initialized) {
        await this.initializationPromise;
      }

      if (!this.superAgent) {
        return {
          response: "I'm still initializing my capabilities. Please try again in a moment.",
          contexts: []
        };
      }

      console.log('[DEBUG] Processing message:', message);
      console.log('[DEBUG] Current state:', this.getCurrentState());

      // Get routing decision
      console.log('[DEBUG] Getting routing decision with capabilities:', 
        this.superAgent.mergedCapabilities);
      
      const routingResult = await messageRoutingTool.invoke({
        message,
        capabilities: this.superAgent.mergedCapabilities.map(cap => ({
          name: cap.name,
          description: cap.description,
          priority: cap.priority || 1
        }))
      });
      console.log('[DEBUG] Routing result:', routingResult);

      // Parse routing result
      const routing = JSON.parse(routingResult);
      console.log('[DEBUG] Parsed routing:', routing);
      
      // Find the selected capability
      let selectedCapability = this.superAgent.mergedCapabilities
        .find(cap => cap.name === routing.selectedCapability);

      if (!selectedCapability) {
        console.warn('[WARN] No capability found for:', routing.selectedCapability);
        // Use the first available capability as fallback
        selectedCapability = this.superAgent.mergedCapabilities[0];
      }
      console.log('[DEBUG] Selected capability:', selectedCapability);

      // Process message with selected capability
      console.log('[DEBUG] Processing with capability:', selectedCapability.name);
      const { response: capabilityResponse, contexts } = await this.processWithCapability(message, selectedCapability);
      console.log('[DEBUG] Generated response:', capabilityResponse);

      // Add to history
      this.messageHistory.push({
        content: message,
        role: "user",
        agentId: "user"
      });

      this.messageHistory.push({
        content: capabilityResponse,
        role: "assistant",
        agentId: this.superAgent.agentId,
        capability: selectedCapability.name
      });

      return { response: capabilityResponse, contexts };
    } catch (error) {
      console.error('[ERROR] Failed to process message:', error);
      return {
        response: "I encountered an error while processing your message. Please try again.",
        contexts: []
      };
    }
  }

  private async processWithCapability(
    message: string,
    capability: SuperAgentConfig["mergedCapabilities"][0]
  ): Promise<{
    response: string;
    contexts: Array<{
      title?: string;
      content: string;
      source?: string;
      score?: number;
    }>;
  }> {
    try {
      // Get relevant context for this capability
      const contexts = await getAgentContext(this.superAgent!.agentId);
      console.log('[DEBUG] Retrieved contexts:', contexts.length);

      // Create capability-specific prompt
      const systemPrompt = `You are an AI assistant specializing in ${capability.name}. 
Your purpose is to ${capability.description}

You have access to the following capabilities:
${this.superAgent!.mergedCapabilities.map(cap => `- ${cap.name}: ${cap.description}`).join('\n')}

Your responses should be:
1. Detailed and informative
2. Based on the available context and capabilities
3. Professional yet conversational
4. Focused on providing actionable information
5. Clear about what you can and cannot do`;

      const userPrompt = `Context information:
${contexts.map(ctx => `[${ctx.title || 'Context'}] ${ctx.content}`).join('\n\n')}

User message: ${message}

Please provide a detailed and helpful response based on your capabilities and the available context.`;

      // Process message
      const response = await model.pipe(new StringOutputParser()).invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]);

      // If response is too generic, add capability-specific details
      let enhancedResponse = response;
      if (response.length < 100 || response.includes("I can use") || response.includes("I am a")) {
        enhancedResponse = `As a ${capability.name} specialist, I can help you with ${capability.description}.\n\n${response}\n\nSpecifically, I can assist with:\n${this.superAgent!.mergedCapabilities.map(cap => `- ${cap.name}: ${cap.description}`).join('\n')}`;
      }

      console.log('[DEBUG] Generated response with capability');
      return { response: enhancedResponse, contexts };
    } catch (error) {
      console.error('[ERROR] Failed to process with capability:', error);
      throw error;
    }
  }

  private getCurrentState(): string {
    if (!this.superAgent) {
      return 'Supervisor not initialized';
    }

    return `
Active Agent: ${this.superAgent.name || 'Unknown'}
Available Capabilities: ${this.superAgent.mergedCapabilities?.map(c => c.name).join(', ') || 'None'}
Message History: ${this.messageHistory.length} messages
Last Message: ${this.messageHistory.length > 0 ? 
  this.messageHistory[this.messageHistory.length - 1].content : 'None'}
    `.trim();
  }
} 