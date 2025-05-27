import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAgentConfig, getAgentContext } from '@/lib/pinecone';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function POST(
  req: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const { input } = await req.json();
    const agentId = params.agentId;

    // Get agent configuration from Pinecone
    const agentConfig = await getAgentConfig(agentId);

    // Get relevant context for the query
    const contextDocs = await getAgentContext(agentId, input);
    const context = contextDocs.map(doc => doc.pageContent).join('\n\n');

    // Create system prompt with context
    const systemPrompt = `You are ${agentConfig.name}, an AI agent designed to ${agentConfig.description}.
    
Your purpose is to help with: ${agentConfig.useCases}

You have access to the following context that you should use to inform your responses:

${context}

When responding:
1. Use the provided context to inform your answers
2. If the context doesn't contain relevant information, say so
3. Stay focused on your specific purpose and use cases
4. Be helpful and professional

Remember:
- You are specialized for ${agentConfig.category}
- Your responses should align with your configured purpose
- Use the context intelligently but don't expose its raw content`;

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Generate response
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: input }
    ]);
    const response = await result.response;

    return NextResponse.json({
      success: true,
      response: response.text(),
      agentId,
    });
  } catch (error) {
    console.error('Error executing agent:', error);
    return NextResponse.json(
      { error: 'Failed to execute agent' },
      { status: 500 }
    );
  }
} 