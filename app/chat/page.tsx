import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function ChatPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🌍
          <span className="ml-2">
            Welcome to Ubumuntu AI - your culturally-aware assistant for personal and business growth in Africa.
          </span>
        </li>
        <li>
          🤝
          <span className="ml-2">
            Built on the principle of Ubuntu: "I am because we are" - fostering community and shared growth.
          </span>
        </li>
        <li className="text-l">
          💡
          <span className="ml-2">
            Ask me anything about business, culture, or personal development in the African context.
          </span>
        </li>
        <li className="text-l">
          🔍
          <span className="ml-2">
            Get region-specific insights, market analysis, and culturally relevant guidance.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking: "How can I adapt my business strategy for the East African market?" or "What are important cultural considerations when expanding to West Africa?"
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <ChatWindow
      endpoint="api/chat/ubumuntu"
      emptyStateComponent={InfoCard}
      placeholder="Ask about business, culture, or personal development in Africa..."
      emoji="🌍"
    />
  );
} 