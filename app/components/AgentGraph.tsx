import React from 'react';
import { AgentMetadata } from '@/app/lib/agents/langchain/types';
import { Graph } from 'react-d3-graph';

interface AgentGraphProps {
  agents: AgentMetadata[];
}

const AgentGraph: React.FC<AgentGraphProps> = ({ agents }) => {
  const graphData = {
    nodes: agents.map(agent => ({
      id: agent.contentId,
      title: agent.title,
      category: agent.primaryCategory,
      capabilities: agent.agent.capabilities.map(c => c.name).join(", "),
      color: getCategoryColor(agent.primaryCategory)
    })),
    links: agents.flatMap(agent => 
      agent.agent.capabilities.map(cap => 
        agent.agent.tools.map(tool => ({
          source: agent.contentId,
          target: `${tool}_${cap.name}`,
          label: cap.name
        }))
      ).flat()
    )
  };

  const graphConfig = {
    nodeHighlightBehavior: true,
    node: {
      color: "lightblue",
      size: 300,
      highlightStrokeColor: "blue",
      labelProperty: "id" as const
    },
    link: {
      highlightColor: "lightblue"
    },
    directed: true,
    height: 600,
    width: 800
  };

  return (
    <div className="w-full h-[600px] border rounded-lg overflow-hidden">
      <Graph
        id="agent-graph"
        data={graphData}
        config={graphConfig}
      />
    </div>
  );
};

function getCategoryColor(category: string): string {
  const colors: { [key: string]: string } = {
    'research': '#4CAF50',
    'analysis': '#2196F3',
    'fieldwork': '#FFC107',
    'documentation': '#9C27B0',
    'default': '#607D8B'
  };
  return colors[category.toLowerCase()] || colors.default;
}

export default AgentGraph; 