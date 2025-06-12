import { cn } from "@/lib/utils";
import { CategoryBubble } from './CategoryBubble';

interface CategoryContext {
  category: string;
  count: number;
  relevantCount: number;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  categoryContexts?: CategoryContext[];
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
        </div>
      </div>
    </div>
  );
} 