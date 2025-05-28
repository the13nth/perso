import {  NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getAgentConfig, getAgentContext } from '@/lib/pinecone';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

// Initialize the Google Gen AI client with the correct configuration
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
  apiVersion: 'v1' // Use the stable v1 API
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    // Extract the agentId from the URL parameters
    const { agentId } = await params;
    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 }
      );
    }

    // Parse the request body
    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    // Get agent configuration and context using the user's query
    const [agentConfig, contextDocs] = await Promise.all([
      getAgentConfig(agentId),
      getAgentContext(agentId, lastUserMessage.content)
    ]);

    // Format context in a more structured way, now including relevance scores
    const formattedContext = contextDocs
      .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
      .map((doc, index) => {
        const score = doc.metadata?.score ? Math.round(doc.metadata.score * 100) : 0;
        return `CONTEXT DOCUMENT ${index + 1} (Relevance: ${score}%):
Title: ${doc.metadata?.title || 'Untitled'}
Content: ${doc.pageContent}
---`;
      }).join('\n\n');

    // Create a more structured and directive system prompt
    const systemPrompt = `You are ${agentConfig.name}, an AI agent specifically designed for ${agentConfig.description}.

YOUR CORE PURPOSE:
${agentConfig.useCases}

IMPORTANT INSTRUCTIONS:
1. You MUST use the following context to inform your answers. This is your knowledge base, sorted by relevance to the current query:

${formattedContext}

2. For every response you give:
   - ALWAYS reference specific information from your context when available
   - If asked something not covered in your context, clearly state: "I don't have specific information about that in my context."
   - Stay focused on your purpose: ${agentConfig.category}
   - Be direct and informative in your responses
   - When using information, prefer more relevant context (higher relevance percentage)

3. DO NOT make up information or speculate beyond your context
4. DO NOT be vague or generic - use specific details from your context
5. If you're unsure about something, admit it clearly

Remember: You are a specialized agent for ${agentConfig.category}. Your responses should demonstrate expertise based on your provided context.`;

    // Convert the conversation history to the format expected by the model
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    // Add the system prompt as the first message
    const fullConversation = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'assistant', parts: [{ text: 'I understand my role and context. I will provide specific, context-based responses.' }] },
      ...conversationHistory
    ];

    // Generate response using the new SDK
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: fullConversation,
      config: {
        maxOutputTokens: 2048,
        temperature: 0.7
      }
    });

    return NextResponse.json({
      success: true,
      response: response.text,
      agentId,
    });
  } catch (error: Error | unknown) {
    console.error('Error executing agent:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to execute agent';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message?.includes('API key')) {
        errorMessage = 'Invalid or missing API key';
        statusCode = 401;
      } else if (error.message?.includes('not found')) {
        errorMessage = 'AI model configuration error';
        statusCode = 404;
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : error },
      { status: statusCode }
    );
  }
} 