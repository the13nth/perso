import { AgentChatInterface } from "@/components/AgentChatInterface";

export default function AgentsPage() {

  return (
    <AgentChatInterface
      endpoint="api/chat/retrieval_agents"
      placeholder="Beep boop! I'm a robot retrieval-focused agent! Ask, 'What are some ways of doing retrieval in LangChain.js?'"
      emoji="🤖"
      showIntermediateStepsToggle={true}
    />
  );
}
