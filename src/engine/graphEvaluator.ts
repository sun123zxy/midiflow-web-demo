import type { Pattern } from '@/types/midi';
import type {
  PatternFlowGraph,
  PatternFlowNode,
  ModifierParams,
  ModifierInputs,
} from '@/types/patternflow';
import { getModifier } from '@/engine/modifiers';

/**
 * Graph evaluation engine with simple caching
 */
export class GraphEvaluator {
  private cache: Map<string, Pattern | null> = new Map();

  /**
   * Evaluate a specific node in the graph
   */
  evaluate(graph: PatternFlowGraph, nodeId: string): Pattern | null {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    // Check cache
    if (this.cache.has(nodeId)) {
      return this.cache.get(nodeId)!;
    }

    // Evaluate node
    const pattern = this.evaluateNode(graph, node);
    
    // Store in cache
    this.cache.set(nodeId, pattern);

    return pattern;
  }

  /**
   * Get all evaluable patterns in the graph (pattern sources and modifier outputs)
   * Returns map of nodeId -> Pattern
   */
  getAllPatterns(graph: PatternFlowGraph): Map<string, Pattern> {
    const patterns = new Map<string, Pattern>();
    
    for (const node of graph.nodes) {
      const pattern = this.evaluate(graph, node.id);
      if (pattern && pattern.notes.length > 0) {
        patterns.set(node.id, pattern);
      }
    }

    return patterns;
  }

  /**
   * Get only leaf nodes (nodes with no outgoing connections) - the final outputs
   * Returns map of nodeId -> Pattern
   */
  getLeafPatterns(graph: PatternFlowGraph): Map<string, Pattern> {
    const patterns = new Map<string, Pattern>();
    
    // Find nodes that have no outgoing edges (leaf nodes)
    const nodesWithOutgoingEdges = new Set(graph.edges.map(e => e.source));
    const leafNodes = graph.nodes.filter(n => !nodesWithOutgoingEdges.has(n.id));
    
    for (const node of leafNodes) {
      const pattern = this.evaluate(graph, node.id);
      if (pattern && pattern.notes.length > 0) {
        patterns.set(node.id, pattern);
      }
    }

    return patterns;
  }

  /**
   * Clear the evaluation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalidate a node and all its downstream dependents
   */
  invalidateNode(graph: PatternFlowGraph, nodeId: string): void {
    // Clear this node
    this.cache.delete(nodeId);
    
    // Find and clear all downstream nodes (nodes that depend on this one)
    const downstreamNodes = this.getDownstreamNodes(graph, nodeId);
    for (const downstreamId of downstreamNodes) {
      this.cache.delete(downstreamId);
    }
  }

  /**
   * Get all nodes downstream from a given node (BFS)
   */
  private getDownstreamNodes(graph: PatternFlowGraph, nodeId: string): Set<string> {
    const downstream = new Set<string>();
    const queue: string[] = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find edges where current is the source
      const outgoingEdges = graph.edges.filter(e => e.source === current);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          downstream.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return downstream;
  }

  /**
   * Evaluate a single node based on its type
   */
  private evaluateNode(graph: PatternFlowGraph, node: PatternFlowNode): Pattern | null {
    const data = node.data;

    switch (data.type) {
      case 'pattern-source':
        return data.pattern;

      case 'modifier':
        return this.evaluateModifier(graph, node);

      default:
        return null;
    }
  }

  /**
   * Evaluate a modifier node
   */
  private evaluateModifier(graph: PatternFlowGraph, node: PatternFlowNode): Pattern | null {
    const data = node.data;
    if (data.type !== 'modifier') return null;

    const modifier = getModifier(data.modifierType);
    if (!modifier) {
      console.error(`Unknown modifier: ${data.modifierType}`);
      return null;
    }

    // Get structured inputs based on modifier definition
    const inputs = this.getModifierInputs(graph, node, modifier.inputs);
    
    // Validate inputs meet requirements
    for (const inputDef of modifier.inputs) {
      if (inputDef.type === 'keyword' && inputDef.required) {
        // Check required keyword input is present
        if (!inputs.keyword || !inputs.keyword[inputDef.key]) {
          return null; // Required keyword input missing
        }
      } else if (inputDef.type === 'positional') {
        // Check positional input meets minCount
        const count = inputs.positional?.length ?? 0;
        if (count < inputDef.minCount) {
          return null; // Not enough positional inputs
        }
      }
    }
    
    // Apply the modifier with structured inputs
    return this.applyModifier(data.modifierType, data.params, inputs);
  }

  /**
   * Apply a modifier function to input patterns
   */
  private applyModifier(
    modifierName: string,
    params: ModifierParams,
    inputs: ModifierInputs
  ): Pattern | null {
    try {
      const modifier = getModifier(modifierName);
      
      if (!modifier) {
        console.error(`Unknown modifier: ${modifierName}`);
        return null;
      }
      
      return modifier.execute(inputs, params);
    } catch (error) {
      console.error(`Error applying modifier ${modifierName}:`, error);
      return null;
    }
  }

  /**
   * Get structured inputs for a modifier node based on input definitions
   */
  private getModifierInputs(
    graph: PatternFlowGraph, 
    node: PatternFlowNode,
    inputDefs: import('@/types/patternflow').InputDefinition[]
  ): ModifierInputs {
    const incomingEdges = graph.edges.filter(e => e.target === node.id);
    const result: ModifierInputs = {};
    
    for (const inputDef of inputDefs) {
      if (inputDef.type === 'keyword') {
        // Find edge with targetHandle matching keyword key
        const edge = incomingEdges.find(e => e.targetHandle === inputDef.key);
        if (edge) {
          const pattern = this.evaluate(graph, edge.source);
          if (pattern) {
            if (!result.keyword) result.keyword = {};
            result.keyword[inputDef.key] = pattern;
          }
        }
      } else {
        // Positional: collect all edges with pos-N handles (dense array, sorted by index)
        const positionalEdges = incomingEdges
          .filter(e => e.targetHandle?.startsWith('pos-'))
          .sort((a, b) => {
            const aIdx = parseInt(a.targetHandle!.split('-')[1]);
            const bIdx = parseInt(b.targetHandle!.split('-')[1]);
            return aIdx - bIdx;
          });
        
        result.positional = positionalEdges
          .map(e => this.evaluate(graph, e.source))
          .filter((p): p is Pattern => p !== null);
      }
    }
    
    return result;
  }

  /**
   * Detect cycles in the graph
   */
  detectCycles(graph: PatternFlowGraph): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[] = [];

    const dfs = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoingEdges = graph.edges.filter((e) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.target)) {
          if (dfs(edge.target, [...path])) {
            return true;
          }
        } else if (recursionStack.has(edge.target)) {
          // Cycle detected
          const cycleStart = path.indexOf(edge.target);
          cycles.push(...path.slice(cycleStart), edge.target);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id, [])) {
          return cycles;
        }
      }
    }

    return null;
  }
}

// Singleton instance
export const graphEvaluator = new GraphEvaluator();
