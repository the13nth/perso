import { StreamingTextResponse, LangChainStream } from 'ai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { AIMessage, HumanMessage, SystemMessage } from 'langchain/schema';
import { NextRequest } from 'next/server';

const SYSTEM_PROMPT = `You are AgentSetupAI, a helpful assistant designed to guide businesses through the process of creating their custom AI agent on the Ubumuntu AI platform.

Your primary goal is to help users complete the agent setup form with appropriate and well-thought-out information. You should:

1. Maintain a friendly and professional tone
2. Provide clear explanations for each field
3. Offer relevant examples when needed
4. Guide users through any difficulties they encounter
5. Validate their inputs and suggest improvements
6. Keep track of their progress through the setup process

The setup process has four main sections:
1. Agent Identity (name, description, logo)
2. Purpose & Functionality (category, use cases, triggers)
3. Tool Access & Integration (knowledge base, API integrations, data access)
4. Deployment Options

Remember to:
- Ask clarifying questions when needed
- Provide specific examples relevant to their business domain
- Explain the importance and impact of each configuration choice
- Help users make informed decisions about their agent's capabilities
- Maintain context throughout the conversation

If you don't know something or aren't sure about a specific detail, be honest and suggest seeking additional information from the documentation or support team.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const { stream, handlers } = LangChainStream();

  const llm = new ChatOpenAI({
    modelName: 'gpt-4',
    streaming: true,
    temperature: 0.7,
  });

  llm.call(
    [
      new SystemMessage(SYSTEM_PROMPT),
      ...messages.map((m: any) =>
        m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content)
      ),
    ],
    {},
    [handlers]
  );

  return new StreamingTextResponse(stream);
} 