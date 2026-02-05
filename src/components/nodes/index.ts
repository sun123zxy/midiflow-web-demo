import type { NodeTypes } from '@xyflow/react';
import { PatternSourceNode } from './PatternSourceNode';
import { ModifierNode } from './ModifierNode';

export const nodeTypes: NodeTypes = {
  'pattern-source': PatternSourceNode,
  modifier: ModifierNode,
};

export { PatternSourceNode, ModifierNode };
