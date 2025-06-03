import React from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Handle, 
  Position,
  NodeProps,
  Edge,
  Node,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ProcessStep {
  id: string;
  label: string;
  type: 'input' | 'process' | 'output' | 'error';
  status: 'pending' | 'running' | 'completed' | 'error';
  details: string;
  timestamp: number;
}

const statusColors: Record<ProcessStep['status'], string> = {
  pending: 'bg-gray-200 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700'
};

const nodeTypes = {
  langNode: ({ data }: NodeProps<ProcessStep>) => {
    return (
      <Card className={cn(
        "px-4 py-2 min-w-[200px]",
        data.status === 'running' && "border-blue-500 shadow-lg",
        data.status === 'completed' && "border-green-500",
        data.status === 'error' && "border-red-500"
      )}>
        <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{data.label}</span>
            <Badge variant="outline" className={cn(
              statusColors[data.status],
              "animate-in fade-in duration-300"
            )}>
              {data.status === 'running' && (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              )}
              {data.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{data.details}</p>
        </div>
        <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
      </Card>
    );
  }
};

interface LangGraphUIProps extends HTMLMotionProps<"div"> {
  steps: ProcessStep[];
}

export function LangGraphUI({ steps, className, ...props }: LangGraphUIProps) {
  // Create nodes from steps with horizontal layout
  const nodes: Node[] = steps.map((step, index) => ({
    id: step.id,
    type: 'langNode',
    position: { 
      x: index * 300, // Spread nodes horizontally
      y: 0 
    },
    data: step
  }));

  // Create edges between nodes with animations for active steps
  const edges: Edge[] = steps.slice(0, -1).map((step, index) => ({
    id: `e${step.id}-${steps[index + 1].id}`,
    source: step.id,
    target: steps[index + 1].id,
    animated: step.status === 'running' || steps[index + 1].status === 'running',
    style: { 
      stroke: step.status === 'error' ? 'var(--destructive)' : 'var(--primary)',
      strokeWidth: 2
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: step.status === 'error' ? 'var(--destructive)' : 'var(--primary)'
    }
  }));

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className={cn(
          "w-full border rounded-lg bg-background overflow-hidden shadow-lg",
          "transition-all duration-300 ease-in-out",
          className
        )}
        {...props}
      >
        <div className="h-[300px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            className="bg-background"
            minZoom={0.5}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </motion.div>
    </AnimatePresence>
  );
} 