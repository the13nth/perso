import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";

export default function StreamingPage() {
  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🌊
          <span className="ml-2">
            This template showcases streaming responses with the Vercel{" "}
            <a href="https://sdk.vercel.ai/docs" target="_blank">
              AI SDK
            </a>{" "}
            in a{" "}
            <a href="https://nextjs.org/" target="_blank">
              Next.js
            </a>{" "}
            project.
          </span>
        </li>
        <li>
          ⚡
          <span className="ml-2">
            The responses are streamed in real-time as they are generated.
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the streaming logic in{" "}
            <code>app/api/chat/streaming/route.ts</code>.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking anything below to see the streaming in action!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );
  return (
    <ChatWindow
      endpoint="api/chat/streaming"
      emptyStateComponent={InfoCard}
      placeholder="Ask anything to see streaming in action..."
      emoji="🌊"
    />
  );
} 