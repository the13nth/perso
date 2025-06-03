import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  Node,
  Edge,
  ConnectionMode,
  MarkerType,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Agent } from '@/lib/agents/remix/types';

interface AgentGraphProps {
  agent: Agent;
  parentAgents: Agent[];
}

const AgentNode = ({ data }: { data: { label: string; type: string; description?: string } }) => {
  return (
    <div className={`px-4 py-2 shadow-lg rounded-md border bg-background min-w-[150px] ${
      data.type === 'system' ? 'border-primary' : ''
    }`}>
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex flex-col gap-1">
        <div className="font-medium truncate">{data.label}</div>
        <div className="text-xs text-muted-foreground">{data.type}</div>
        {data.description && (
          <div className="text-xs text-muted-foreground mt-1">{data.description}</div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
};

const SystemNode = ({ data }: { data: { label: string; type: string } }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border border-primary bg-primary/10 min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex flex-col gap-1">
        <div className="font-medium truncate text-primary">{data.label}</div>
        <div className="text-xs text-primary/80">{data.type}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
};

const QueryNode = ({ data }: { data: { label: string } }) => {
  return (
    <div className="px-4 py-2 shadow-lg rounded-md border-2 border-dashed border-muted-foreground bg-background">
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
      <div className="font-medium text-sm text-center">{data.label}</div>
    </div>
  );
};

const nodeTypes = {
  agent: AgentNode,
  system: SystemNode,
  query: QueryNode,
};

export function AgentGraph({ agent, parentAgents }: AgentGraphProps) {
  const nodes: Node[] = useMemo(() => {
    const parentNodes = parentAgents.map((parent, index) => ({
      id: parent.agentId,
      type: 'agent',
      data: { 
        label: parent.name, 
        type: 'Parent Agent',
        description: parent.description
      },
      position: { 
        x: (index - (parentAgents.length - 1) / 2) * 300, 
        y: 100 
      },
    }));

    // System nodes
    const systemNodes = [
      {
        id: 'query',
        type: 'query',
        data: { label: 'User Query' },
        position: { x: 0, y: 0 },
      },
      {
        id: 'supervisor',
        type: 'system',
        data: { label: 'Supervisor', type: 'System Component' },
        position: { x: 0, y: 200 },
      },
      {
        id: 'context_analyzer',
        type: 'system',
        data: { label: 'Context Analyzer', type: 'System Component' },
        position: { x: -200, y: 300 },
      },
      {
        id: 'capability_merger',
        type: 'system',
        data: { label: 'Capability Merger', type: 'System Component' },
        position: { x: 0, y: 300 },
      },
      {
        id: 'configuration',
        type: 'system',
        data: { label: 'Configuration', type: 'System Component' },
        position: { x: 200, y: 300 },
      },
    ];

    const superNode = {
      id: agent.agentId,
      type: 'agent',
      data: { 
        label: agent.name, 
        type: 'Super Agent',
        description: agent.description
      },
      position: { x: 0, y: 400 },
    };

    return [...systemNodes, ...parentNodes, superNode];
  }, [agent, parentAgents]);

  const edges: Edge[] = useMemo(() => {
    const systemEdges = [
      // Query flow
      {
        id: 'query-supervisor',
        source: 'query',
        target: 'supervisor',
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      // Supervisor to components
      {
        id: 'supervisor-context',
        source: 'supervisor',
        target: 'context_analyzer',
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'supervisor-capability',
        source: 'supervisor',
        target: 'capability_merger',
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'supervisor-config',
        source: 'supervisor',
        target: 'configuration',
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];

    // Parent agent connections
    const parentEdges = parentAgents.flatMap(parent => [
      {
        id: `${parent.agentId}-context`,
        source: parent.agentId,
        target: 'context_analyzer',
        animated: true,
        style: { stroke: 'var(--muted-foreground)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: `${parent.agentId}-capability`,
        source: parent.agentId,
        target: 'capability_merger',
        animated: true,
        style: { stroke: 'var(--muted-foreground)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ]);

    // Component to super agent connections
    const componentEdges = [
      {
        id: 'context-super',
        source: 'context_analyzer',
        target: agent.agentId,
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'capability-super',
        source: 'capability_merger',
        target: agent.agentId,
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: 'config-super',
        source: 'configuration',
        target: agent.agentId,
        animated: true,
        style: { stroke: 'var(--primary)' },
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ];

    return [...systemEdges, ...parentEdges, ...componentEdges];
  }, [agent, parentAgents]);

  const onInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    reactFlowInstance.fitView();
  }, []);

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
} 