import { cn } from "@/lib/utils";
import { CategoryBubble } from './CategoryBubble';

interface CategoryContext {
  category: string;
  count: number;
  relevantCount: number;
}

interface Source {
  contentPreview: string;
  source: string;
  score: number;
  category: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  categoryContexts?: CategoryContext[];
}

// Temporary Sources Card Component
function SourcesCard() {
  const dummySources: Source[] = [
    {
      contentPreview: "James 5:7-11 - Be patient therefore, brethren, unto the coming of the Lord. Behold, the husbandman waiteth for the precious fruit of the earth...",
      source: "Bible - James 5:7",
      score: 0.95,
      category: "bible"
    },
    {
      contentPreview: "Take, my brethren, the prophets, who have spoken in the name of the Lord, for an example of suffering affliction, and of patience.",
      source: "Bible - James 5:10",
      score: 0.92,
      category: "bible"
    },
    {
      contentPreview: "Behold, we count them happy which endure. Ye have heard of the patience of Job, and have seen the end of the Lord...",
      source: "Bible - James 5:11",
      score: 0.89,
      category: "bible"
    }
  ];

  return (
    <div className="mt-4 bg-gray-800/40 rounded-lg border border-gray-700">
      <div className="px-4 py-2 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-200">Sources & References</h3>
      </div>
      <div className="p-4 space-y-3">
        {dummySources.map((source, index) => (
          <div key={index} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-400">{source.source}</span>
              <span className="text-xs text-gray-400">
                {Math.round(source.score * 100)}% relevance
              </span>
            </div>
            <p className="text-sm text-gray-300">{source.contentPreview}</p>
            <div className="text-xs text-gray-500">Category: {source.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChatMessageProps {
  message: Message;
  className?: string;
}

export function ChatMessage({ message, ...props }: ChatMessageProps) {
  const isAiMessage = message.role === 'assistant';
  
  return (
    <div className={cn("group relative mb-4 flex items-start md:mb-6", props.className)}>
      <div className="flex-1 space-y-2 overflow-hidden px-1">
        <div className="prose break-words dark:prose-invert prose-p:leading-relaxed prose-pre:p-0">
          {message.content}
          
          {/* Add category bubbles if AI message and has context info */}
          {isAiMessage && message.categoryContexts && message.categoryContexts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.categoryContexts.map((ctx: CategoryContext) => (
                <CategoryBubble
                  key={ctx.category}
                  category={ctx.category}
                  count={ctx.count}
                  relevantCount={ctx.relevantCount}
                />
              ))}
            </div>
          )}

          {/* Add Sources Card for AI messages */}
          {isAiMessage && <SourcesCard />}
        </div>
      </div>
    </div>
  );
} 