import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { usePatternFlowStore } from '@/store/patternFlowStore';
import { nodeTypes } from './nodes';

interface PatternFlowProps {
  onNodeSelect?: (nodeId: string | null) => void;
}

export function PatternFlow({ onNodeSelect }: PatternFlowProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
  } = usePatternFlowStore();

  // Validate connection: prevent multiple edges to the same input port
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      // Prevent self-connections
      if (connection.source === connection.target) {
        return false;
      }
      
      // Check if there's already an edge connected to this target port
      // For nodes without explicit handle IDs, targetHandle will be null/undefined
      const existingEdge = edges.find((edge) => {
        const sameTarget = edge.target === connection.target;
        const sameHandle = 
          (edge.targetHandle ?? null) === (connection.targetHandle ?? null);
        return sameTarget && sameHandle;
      });
      
      // Connection is valid if there's no existing edge to this port
      return !existingEdge;
    },
    [edges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    selectNode(node.id);
    if (onNodeSelect) {
      onNodeSelect(node.id);
    }
  }, [onNodeSelect, selectNode]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    if (onNodeSelect) {
      onNodeSelect(null);
    }
  }, [selectNode, onNodeSelect]);

  return (
    <div className="w-full h-full bg-gray-900">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        attributionPosition="bottom-left"
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </div>
  );
}
