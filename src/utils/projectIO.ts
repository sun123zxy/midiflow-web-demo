/**
 * Project Save/Load utilities for MidiFlow
 * Handles serialization/deserialization of .mdf project files
 */

import Fraction from 'fraction.js';
import type { Node, Edge } from '@xyflow/react';
import type { Pattern, Note } from '@/types/midi';
import type { PatternFlowNodeData, PatternNodeData, ModifierNodeData } from '@/types/patternflow';
import type { TimelineItem } from '@/store/timelineStore';
import type {
  MidiFlowProject,
  SerializedFraction,
  SerializedNote,
  SerializedPattern,
  SerializedPatternFlowNodeData,
  SerializedPatternFlowNode,
  SerializedTimelineItem,
  ProjectSettings,
  ProjectTimelineState,
  ProjectPatternFlowState,
} from '@/types/project';

const PROJECT_VERSION = '1.0.0';

// ============================================================================
// Serialization (to JSON-safe format)
// ============================================================================

function serializeFraction(f: Fraction): SerializedFraction {
  return { n: Number(f.n) * Number(f.s), d: Number(f.d) };
}

function serializeNote(note: Note): SerializedNote {
  return {
    duration: serializeFraction(note.duration),
    note: note.note,
    velocity: note.velocity,
  };
}

function serializePattern(pattern: Pattern): SerializedPattern {
  return {
    notes: pattern.notes.map(([time, note]) => [
      serializeFraction(time),
      serializeNote(note),
    ]),
    duration: pattern.duration ? serializeFraction(pattern.duration) : null,
    id: pattern.id,
    name: pattern.name,
  };
}

function serializePatternNodeData(data: PatternNodeData): SerializedPatternFlowNodeData {
  return {
    type: 'pattern-source',
    pattern: serializePattern(data.pattern),
    name: data.name,
  };
}

function serializeModifierNodeData(data: ModifierNodeData): SerializedPatternFlowNodeData {
  // Deep clone params and serialize any Fraction values
  const serializedParams = serializeValue(data.params);
  
  return {
    type: 'modifier',
    modifierType: data.modifierType,
    params: serializedParams as Record<string, unknown>,
    positionalInputCount: data.positionalInputCount,
    name: data.name,
  };
}

/**
 * Recursively serialize a value, converting Fractions to SerializedFraction
 */
function serializeValue(value: unknown): unknown {
  if (value instanceof Fraction) {
    return { __type: 'Fraction', n: Number(value.n) * Number(value.s), d: Number(value.d) };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = serializeValue(v);
    }
    return result;
  }
  return value;
}

function serializePatternFlowNodeData(data: PatternFlowNodeData): SerializedPatternFlowNodeData {
  if (data.type === 'pattern-source') {
    return serializePatternNodeData(data);
  } else {
    return serializeModifierNodeData(data);
  }
}

function serializeTimelineItem(item: TimelineItem): SerializedTimelineItem {
  return {
    id: item.id,
    time: serializeFraction(item.time),
    channel: item.channel,
    nodeId: item.nodeId,
  };
}

// ============================================================================
// Deserialization (from JSON-safe format)
// ============================================================================

function deserializeFraction(f: SerializedFraction): Fraction {
  return new Fraction(f.n, f.d);
}

function deserializeNote(note: SerializedNote): Note {
  return {
    duration: deserializeFraction(note.duration),
    note: note.note,
    velocity: note.velocity,
  };
}

function deserializePattern(pattern: SerializedPattern): Pattern {
  return {
    notes: pattern.notes.map(([time, note]) => [
      deserializeFraction(time),
      deserializeNote(note),
    ]),
    duration: pattern.duration ? deserializeFraction(pattern.duration) : null,
    id: pattern.id,
    name: pattern.name,
  };
}

/**
 * Recursively deserialize a value, converting {__type: 'Fraction', n, d} back to Fraction
 */
function deserializeValue(value: unknown): unknown {
  if (value !== null && typeof value === 'object') {
    // Check if it's a serialized Fraction
    const obj = value as Record<string, unknown>;
    if (obj.__type === 'Fraction' && typeof obj.n === 'number' && typeof obj.d === 'number') {
      return new Fraction(obj.n, obj.d);
    }
    // Check if it's an array
    if (Array.isArray(value)) {
      return value.map(deserializeValue);
    }
    // Recurse into object
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deserializeValue(v);
    }
    return result;
  }
  return value;
}

function deserializePatternFlowNodeData(data: SerializedPatternFlowNodeData): PatternFlowNodeData {
  if (data.type === 'pattern-source') {
    return {
      type: 'pattern-source',
      pattern: deserializePattern(data.pattern),
      name: data.name,
    };
  } else {
    // Deserialize params with Fraction support
    const params = deserializeValue(data.params) as Record<string, unknown>;
    return {
      type: 'modifier',
      modifierType: data.modifierType,
      params: { modifier: data.modifierType, ...params },
      positionalInputCount: data.positionalInputCount,
      name: data.name,
    };
  }
}

function deserializeTimelineItem(item: SerializedTimelineItem): TimelineItem {
  return {
    id: item.id,
    time: deserializeFraction(item.time),
    channel: item.channel,
    nodeId: item.nodeId,
  };
}

// ============================================================================
// Project Export/Import
// ============================================================================

export interface ExportProjectParams {
  // PatternFlow state
  nodes: Node<PatternFlowNodeData>[];
  edges: Edge[];
  
  // Timeline state
  timelineItems: TimelineItem[];
  channelPrograms: number[];
  channelMuted: boolean[];
  channelSolo: boolean[];
  pixelsPerBeat: number;
  beatsPerMeasure: number;
  playbackStartTime: Fraction;
  snapEnabled: boolean;
  snapDenominator: number;
  
  // Settings
  settings: ProjectSettings;
  
  // Optional project name
  projectName?: string;
}

/**
 * Export the current project state to a serializable object
 */
export function exportProject(params: ExportProjectParams): MidiFlowProject {
  const {
    nodes,
    edges,
    timelineItems,
    channelPrograms,
    channelMuted,
    channelSolo,
    pixelsPerBeat,
    beatsPerMeasure,
    playbackStartTime,
    snapEnabled,
    snapDenominator,
    settings,
    projectName,
  } = params;
  
  const now = new Date().toISOString();
  
  const patternFlow: ProjectPatternFlowState = {
    nodes: nodes.map(node => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: serializePatternFlowNodeData(node.data),
      selected: node.selected,
    })) as SerializedPatternFlowNode[],
    edges: edges,
  };
  
  const timeline: ProjectTimelineState = {
    items: timelineItems.map(serializeTimelineItem),
    channelPrograms,
    channelMuted,
    channelSolo,
    pixelsPerBeat,
    beatsPerMeasure,
    playbackStartTime: serializeFraction(playbackStartTime),
    snapEnabled,
    snapDenominator,
  };
  
  return {
    version: PROJECT_VERSION,
    name: projectName,
    createdAt: now,
    updatedAt: now,
    settings,
    patternFlow,
    timeline,
  };
}

/**
 * Export project to a downloadable Blob
 */
export function exportProjectToBlob(params: ExportProjectParams): Blob {
  const project = exportProject(params);
  const json = JSON.stringify(project, null, 2);
  return new Blob([json], { type: 'application/json' });
}

export interface ImportedProject {
  // PatternFlow state
  nodes: Node<PatternFlowNodeData>[];
  edges: Edge[];
  
  // Timeline state
  timelineItems: TimelineItem[];
  channelPrograms: number[];
  channelMuted: boolean[];
  channelSolo: boolean[];
  pixelsPerBeat: number;
  beatsPerMeasure: number;
  playbackStartTime: Fraction;
  snapEnabled: boolean;
  snapDenominator: number;
  
  // Settings
  settings: ProjectSettings;
  
  // Metadata
  projectName?: string;
  version: string;
}

/**
 * Import a project from a File
 */
export async function importProject(file: File): Promise<ImportedProject> {
  const text = await file.text();
  const project = JSON.parse(text) as MidiFlowProject;
  
  // Version check - we can add migration logic here in the future
  if (!project.version) {
    throw new Error('Invalid project file: missing version');
  }
  
  // Deserialize PatternFlow nodes
  const nodes = project.patternFlow.nodes.map(node => ({
    ...node,
    data: deserializePatternFlowNodeData(node.data),
  })) as Node<PatternFlowNodeData>[];
  
  // Deserialize timeline items
  const timelineItems = project.timeline.items.map(deserializeTimelineItem);
  
  return {
    nodes,
    edges: project.patternFlow.edges,
    timelineItems,
    channelPrograms: project.timeline.channelPrograms,
    channelMuted: project.timeline.channelMuted,
    channelSolo: project.timeline.channelSolo,
    pixelsPerBeat: project.timeline.pixelsPerBeat,
    beatsPerMeasure: project.timeline.beatsPerMeasure,
    playbackStartTime: deserializeFraction(project.timeline.playbackStartTime),
    snapEnabled: project.timeline.snapEnabled,
    snapDenominator: project.timeline.snapDenominator,
    settings: project.settings,
    projectName: project.name,
    version: project.version,
  };
}

/**
 * Trigger download of project file
 */
export function downloadProject(params: ExportProjectParams, filename = 'project.mdf'): void {
  const blob = exportProjectToBlob(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
