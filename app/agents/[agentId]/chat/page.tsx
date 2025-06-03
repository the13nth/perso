import { AgentChatInterface } from "@/app/components/AgentChatInterface";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  return <AgentChatInterface endpoint={`/api/agents/${agentId}/chat`} />;
}