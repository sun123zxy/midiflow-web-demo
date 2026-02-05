import type { Node, Edge } from '@xyflow/react';
import type { Pattern } from './midi';

/**
 * Input definitions for modifiers
 */

// Keyword input - named parameter with label
export type KeywordInput = {
  type: 'keyword';
  key: string;           // Parameter key for routing
  label: string;         // Display label next to port
  required: boolean;     // Whether connection is required
};

// Positional input - ordered list of inputs
export type PositionalInput = {
  type: 'positional';
  minCount: number;      // Minimum inputs (default: 1)
  label?: string;        // Optional group label
};

export type InputDefinition = KeywordInput | PositionalInput;

/**
 * Parameter definition for modifiers
 */
export type ParameterDefinition = {
  type: 'number' | 'fraction' | 'slider' | 'code' | 'midi-note' | 'midi-128' | 'boolean';
  defaultValue: any;
  range?: [number, number];  // For slider and numeric types
  step?: number;              // For slider type
  label: string;              // Display label
  description?: string;       // Tooltip/help text
  unit?: string;              // Unit label (e.g., "semitones", "bpm")
};

/**
 * Input structure passed to modifiers
 */
export type ModifierInputs = {
  keyword?: Record<string, Pattern>;  // Named inputs by key
  positional?: Pattern[];              // Ordered inputs
};

/**
 * PatternFlow node types
 */

// Pattern source node - creates a pattern
export type PatternNodeData = {
  type: 'pattern-source';
  pattern: Pattern;
  name: string;
};

// Modifier node - uses dynamic registration system
// No hardcoded modifier types - they're registered at runtime
export type ModifierType = string;

// Parameter object - shape depends on the modifier
// Each modifier defines its own parameter structure
export type ModifierParams = {
  modifier: string;
  [key: string]: any;
};

export type ModifierNodeData = {
  type: 'modifier';
  modifierType: ModifierType;
  params: ModifierParams;
  positionalInputCount?: number;  // Current count of positional input slots
  name: string;  // User-editable name/subtitle
};

export type PatternFlowNodeData = PatternNodeData | ModifierNodeData;

export type PatternFlowNode = Node<PatternFlowNodeData>;

export type PatternFlowEdge = Edge;

/**
 * Complete PatternFlow graph
 */
export interface PatternFlowGraph {
  nodes: PatternFlowNode[];
  edges: PatternFlowEdge[];
}

/**
 * Evaluation cache entry
 */
export interface EvaluationCacheEntry {
  pattern: Pattern;
  inputHash: string;
  timestamp: number;
}
