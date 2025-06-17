import { cn } from "@/utils/cn";
import type { Message } from "ai/react";

interface Source {
  contentPreview: string;
  source: string;
  score: number;
  category: string;
}

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources?: Source[];
}) {
  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {props.aiEmoji}
        </div>
      )}

      <div className="whitespace-pre-wrap flex flex-col">
        <span>{props.message.content}</span>

        {props.sources && props.sources.length > 0 && (
          <div className="mt-4 bg-gray-800/40 rounded-lg border border-gray-700">
            <div className="px-4 py-2 border-b border-gray-700">
              <h3 className="text-sm font-medium text-gray-200">Sources & References</h3>
            </div>
            <div className="p-4 space-y-3">
              {props.sources.map((source, index) => (
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
        )}
      </div>
    </div>
  );
}
