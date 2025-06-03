import { NextRequest, NextResponse } from "next/server";
import { Message } from "ai";
import { AgentSupervisor } from "@/app/lib/agents/langchain/supervisor";
import { getAgentConfig } from "@/lib/pinecone";
import { convertPineconeAgentToConfig } from "@/app/lib/agents/langchain/config";
import { auth } from "@clerk/nextjs/server";

// Store supervisors in memory (in production, use Redis or similar)
const supervisors = new Map<string, AgentSupervisor>();

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { agentId } = await context.params;
    console.log('[DEBUG] Chat route called with agentId:', agentId);

    const { userId } = await auth();
    if (!userId) {
      console.log('[DEBUG] Unauthorized request');
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { messages } = await request.json();
    const currentMessage = messages[messages.length - 1];
    
    console.log('[DEBUG] Processing message:', {
      agentId,
      messageContent: currentMessage.content,
      totalMessages: messages.length
    });

    // Get or create supervisor
    let supervisor = supervisors.get(agentId);
    if (!supervisor) {
      console.log('[DEBUG] Creating new supervisor for agent:', agentId);
      
      const pineconeAgent = await getAgentConfig(agentId);
      if (!pineconeAgent) {
        console.log('[ERROR] Agent not found:', agentId);
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 }
        );
      }
      console.log('[DEBUG] Retrieved agent config:', {
        name: pineconeAgent.name,
        type: pineconeAgent.type,
        hasParentAgents: !!pineconeAgent.parentAgents
      });

      // Convert Pinecone agent to LangChain format
      const agent = convertPineconeAgentToConfig(pineconeAgent);
      console.log('[DEBUG] Converted agent config:', {
        name: agent.name,
        capabilities: agent.capabilities.map(c => c.name)
      });

      // If this is a super agent, get and convert parent agents
      const parentAgents = typeof pineconeAgent.parentAgents === 'string'
        ? await Promise.all(
            pineconeAgent.parentAgents.split(',')
              .map(async id => {
                const parentPineconeAgent = await getAgentConfig(id);
                return convertPineconeAgentToConfig(parentPineconeAgent);
              })
          )
        : [agent];
      
      console.log('[DEBUG] Retrieved parent agents:', 
        parentAgents.map(a => ({ id: a.agentId, name: a.name, capabilities: a.capabilities.map(c => c.name) })));

      supervisor = new AgentSupervisor(parentAgents);
      supervisors.set(agentId, supervisor);
      console.log('[DEBUG] Created and stored new supervisor');
    } else {
      console.log('[DEBUG] Using existing supervisor for agent:', agentId);
    }

    // Process message
    console.log('[DEBUG] Processing message with supervisor');
    const response = await supervisor.processMessage(currentMessage.content);
    console.log('[DEBUG] Received response:', response);

    // Format response as a message
    const responseMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response.response,
    };

    console.log('[DEBUG] Sending response message');
    return NextResponse.json({ messages: [...messages, responseMessage] });
  } catch (error) {
    console.error('[ERROR] Error in chat route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
} 