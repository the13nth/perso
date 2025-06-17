import { AgentChatInterface } from '@/app/components/chat/AgentChatInterface';
import { AgentFactory } from '@/lib/agents/AgentFactory';

interface AgentChatPageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function AgentChatPage({ params }: AgentChatPageProps) {
  const resolvedParams = await params;
  // In a real app, you'd get the user ID from your auth system
  const userId = 'test_user';
  
  // Get initial context for the agent
  const factory = new AgentFactory();
  const agent = await factory.createAgent({
    agentId: resolvedParams.agentId,
    userId,
    contextOptions: {
      userId,
      includeProjectContext: true,
      includeUserHistory: true
    }
  });
  
  return (
    <div className="h-screen p-4">
      <AgentChatInterface
        agentId={resolvedParams.agentId}
        userId={userId}
        initialContext={agent.context}
      />
    </div>
  );
} 