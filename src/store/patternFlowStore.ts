import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Edge, Node, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import { addEdge, applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { PatternFlowNodeData, ModifierNodeData } from '@/types/patternflow';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { getModifier } from '@/engine/modifierRegistry';

interface PatternFlowState {
  nodes: Node<PatternFlowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  
  // Actions
  setNodes: (nodes: Node<PatternFlowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange<Node<PatternFlowNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (node: Node<PatternFlowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<PatternFlowNodeData>) => void;
  selectNode: (nodeId: string | null) => void;
  reset: () => void;
}

const initialState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
};

export const usePatternFlowStore = create<PatternFlowState>()(
  immer((set) => ({
    ...initialState,

    setNodes: (nodes) => set({ nodes }),
    
    setEdges: (edges) => set({ edges }),

    onNodesChange: (changes) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as Node<PatternFlowNodeData>[];
      });
    },

    onEdgesChange: (changes) => {
      // Detect affected nodes and invalidate cache BEFORE state changes
      const currentState = usePatternFlowStore.getState();
      const affectedNodeIds = new Set(
        changes
          .filter(c => c.type === 'remove')
          .map(c => currentState.edges.find(e => e.id === c.id))
          .filter((e): e is Edge => e !== undefined)
          .map(e => e.target)
      );
      
      const positionalAffectedIds = new Set(
        changes
          .filter(c => c.type === 'remove')
          .map(c => currentState.edges.find(e => e.id === c.id))
          .filter((e): e is Edge => e?.targetHandle?.startsWith('pos-') ?? false)
          .map(e => e.target)
      );
      
      // Invalidate cache FIRST to prevent stale reads during render
      if (affectedNodeIds.size > 0) {
        affectedNodeIds.forEach(nodeId => {
          graphEvaluator.invalidateNode({ nodes: currentState.nodes, edges: currentState.edges }, nodeId);
        });
      }
      
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges);
        
        // Renumber positional edges for affected nodes
        if (positionalAffectedIds.size > 0) {
          const edgeMap = new Map<string, number>();
          
          // Collect and sort positional edges per node
          for (const nodeId of positionalAffectedIds) {
            state.edges
              .filter(e => e.target === nodeId && e.targetHandle?.startsWith('pos-'))
              .sort((a, b) => parseInt(a.targetHandle!.split('-')[1]) - parseInt(b.targetHandle!.split('-')[1]))
              .forEach((edge, idx) => edgeMap.set(edge.id, idx));
          }
          
          // Renumber edges in one pass
          state.edges.forEach((edge, i) => {
            const newIndex = edgeMap.get(edge.id);
            if (newIndex !== undefined) {
              state.edges[i] = { ...edge, targetHandle: `pos-${newIndex}` };
            }
          });
          
          // Update positionalInputCount for affected nodes
          state.nodes.forEach((node, i) => {
            if (!positionalAffectedIds.has(node.id)) return;
            
            const data = node.data as ModifierNodeData;
            if (data.type !== 'modifier' || !data.positionalInputCount) return;
            
            const count = state.edges.filter(e => e.target === node.id && e.targetHandle?.startsWith('pos-')).length;
            const positionalInput = getModifier(data.modifierType)?.inputs.find((inp): inp is { type: 'positional'; minCount: number } => inp.type === 'positional');
            const minCount = positionalInput?.minCount ?? 1;
            
            state.nodes[i] = {
              ...node,
              data: { ...data, positionalInputCount: Math.max(count, minCount) },
            } as Node<PatternFlowNodeData>;
          });
        }
      });
    },

    onConnect: (connection) => {
      // Invalidate cache BEFORE state update
      if (connection.target) {
        const currentState = usePatternFlowStore.getState();
        graphEvaluator.invalidateNode({ nodes: currentState.nodes, edges: currentState.edges }, connection.target);
      }
      
      set((state) => {
        state.edges = addEdge(connection, state.edges);
      });
    },

    addNode: (node) => {
      set((state) => {
        state.nodes.push(node);
      });
    },

    deleteNode: (nodeId) => {
      set((state) => {
        state.nodes = state.nodes.filter((n: Node<PatternFlowNodeData>) => n.id !== nodeId);
        state.edges = state.edges.filter((e: Edge) => e.source !== nodeId && e.target !== nodeId);
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
      });
    },

    updateNodeData: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n: Node<PatternFlowNodeData>) => n.id === nodeId);
        if (node) {
          node.data = { ...node.data, ...data } as PatternFlowNodeData;
        }
      });
      // Only invalidate cache if we're updating something other than just 'name'
      // (name changes don't affect pattern output)
      const hasNonNameChanges = Object.keys(data).some(key => key !== 'name');
      if (hasNonNameChanges) {
        const state = usePatternFlowStore.getState();
        graphEvaluator.invalidateNode({ nodes: state.nodes, edges: state.edges }, nodeId);
      }
    },

    selectNode: (nodeId) => {
      set((state) => {
        // Update selectedNodeId
        state.selectedNodeId = nodeId;
        
        // Update the 'selected' property on all nodes for ReactFlow visual feedback
        state.nodes.forEach((node: Node<PatternFlowNodeData>) => {
          node.selected = node.id === nodeId;
        });
      });
    },
    reset: () => set(initialState),
  }))
);
