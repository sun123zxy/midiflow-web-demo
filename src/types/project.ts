/**
 * Project file format types for MidiFlow
 * .mdf files are JSON with this structure
 */

import type { Edge } from '@xyflow/react';

/**
 * Serializable version of a Fraction (for JSON)
 */
export interface SerializedFraction {
  n: number;
  d: number;
}

/**
 * Serializable version of a Note
 */
export interface SerializedNote {
  duration: SerializedFraction;
  note: number;
  velocity: number;
}

/**
 * Serializable version of a Pattern
 */
export interface SerializedPattern {
  notes: Array<[SerializedFraction, SerializedNote]>;
  duration: SerializedFraction | null;
  id?: string;
  name?: string;
}

/**
 * Serializable version of PatternNodeData
 */
export interface SerializedPatternNodeData {
  type: 'pattern-source';
  pattern: SerializedPattern;
  name: string;
}

/**
 * Serializable modifier node data (params may contain Fractions)
 */
export interface SerializedModifierNodeData {
  type: 'modifier';
  modifierType: string;
  params: Record<string, unknown>;
  positionalInputCount?: number;
  name: string;
}

export type SerializedPatternFlowNodeData = SerializedPatternNodeData | SerializedModifierNodeData;

/**
 * Serializable timeline item
 */
export interface SerializedTimelineItem {
  id: string;
  time: SerializedFraction;
  channel: number;
  nodeId: string;
}

/**
 * Settings that should be saved
 */
export interface ProjectSettings {
  tempo: number;
  beatsPerMeasure: number;
  beatUnit: number;
  ppq: number;
  timelineLeftBorder: number;
  timelineRightBorder: number;
  patternEditorLeftBorder: number;
  patternEditorRightBorder: number;
}

/**
 * Timeline state that should be saved
 */
export interface ProjectTimelineState {
  items: SerializedTimelineItem[];
  channelPrograms: number[];
  channelMuted: boolean[];
  channelSolo: boolean[];
  pixelsPerBeat: number;
  beatsPerMeasure: number;
  playbackStartTime: SerializedFraction;
  snapEnabled: boolean;
  snapDenominator: number;
}

/**
 * Serialized node structure (compatible with ReactFlow Node but with serialized data)
 */
export interface SerializedPatternFlowNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: SerializedPatternFlowNodeData;
  selected?: boolean;
  [key: string]: unknown;
}

/**
 * PatternFlow state that should be saved
 */
export interface ProjectPatternFlowState {
  nodes: SerializedPatternFlowNode[];
  edges: Edge[];
}

/**
 * Complete project file structure
 */
export interface MidiFlowProject {
  version: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  patternFlow: ProjectPatternFlowState;
  timeline: ProjectTimelineState;
}
