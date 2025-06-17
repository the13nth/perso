'use client';

import { useState } from 'react';
import { ProcessedContext, Vector, ContextScore } from '@/lib/services/context/types';

interface AgentContextDisplayProps {
  context: ProcessedContext;
  className?: string;
}

interface VectorWithScore extends Vector {
  score?: ContextScore;
}

export function AgentContextDisplay({ context, className = '' }: AgentContextDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Combine vectors with their scores
  const vectorsWithScores: VectorWithScore[] = context.vectors.map(vector => ({
    ...vector,
    score: context.scores.get(vector.id)
  }));
  
  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Context Information</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-500 hover:text-blue-700"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      </div>
      
      <div className="space-y-4">
        {/* Vectors Section */}
        <div>
          <h4 className="font-medium mb-2">Relevant Vectors</h4>
          <div className="space-y-2">
            {vectorsWithScores.slice(0, isExpanded ? undefined : 3).map((vector, index) => (
              <div
                key={index}
                className="bg-gray-50 p-2 rounded"
              >
                <div className="text-sm">{vector.metadata.content}</div>
                {vector.score && (
                  <div className="text-xs text-gray-500 mt-1">
                    Direct: {vector.score.directRelevance.toFixed(3)},
                    Bridge: {vector.score.bridgeRelevance.toFixed(3)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Bridges Section */}
        {isExpanded && context.bridges && context.bridges.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Category Bridges</h4>
            <div className="space-y-2">
              {context.bridges.map((bridge, index) => (
                <div
                  key={index}
                  className="bg-gray-50 p-2 rounded"
                >
                  <div className="text-sm">
                    {bridge.sourceCategory} → {bridge.targetCategory}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Strength: {bridge.bridgeStrength.toFixed(3)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Categories Section */}
        {isExpanded && context.metadata.categories.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">Categories</h4>
            <div className="flex flex-wrap gap-2">
              {context.metadata.categories.map((category, index) => (
                <div
                  key={index}
                  className="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded"
                >
                  {category}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Processing Info */}
        {isExpanded && (
          <div className="text-xs text-gray-500">
            Processed {context.metadata.totalVectors} vectors in {context.metadata.processingTime}ms
          </div>
        )}
      </div>
    </div>
  );
} 