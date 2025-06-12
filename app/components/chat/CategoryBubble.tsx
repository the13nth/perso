import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CategoryBubbleProps {
  category: string;
  count: number;
  relevantCount: number;
}

export function CategoryBubble({ category, count, relevantCount }: CategoryBubbleProps) {
  const getColor = (relevantRatio: number) => {
    if (relevantRatio >= 0.7) return 'bg-green-500/20 text-green-700 hover:bg-green-500/30';
    if (relevantRatio >= 0.4) return 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30';
    return 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30';
  };

  const relevantRatio = count > 0 ? relevantCount / count : 0;
  const colorClass = getColor(relevantRatio);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant="outline" className={`${colorClass} transition-colors`}>
            {category} ({relevantCount}/{count})
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            {relevantCount} highly relevant documents out of {count} total from {category}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 