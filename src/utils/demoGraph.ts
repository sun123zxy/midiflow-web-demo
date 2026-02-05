import Fraction from 'fraction.js';
import type { PatternFlowNode } from '@/types/patternflow';
import { createPattern, addNote, createNote } from '@/engine/pattern';

/**
 * Create a demo PatternFlow graph with nodes and edges
 * Based on the Python test_play.py demo
 */
export function createDemoGraph(): {
  nodes: PatternFlowNode[];
  edges: { id: string; source: string; target: string }[];
} {
  // Pattern 1: pitches1 = [60, 65, 67, 70, 67, 65]
  let pattern1 = createPattern();
  const pitches1 = [60, 65, 67, 70, 67, 65];
  pitches1.forEach((pitch, i) => {
    const note = createNote(pitch, 100, new Fraction(1, 4));
    pattern1 = addNote(pattern1, new Fraction(i, 8), note);
  });
  // Set explicit duration: 6/8
  pattern1 = { ...pattern1, duration: new Fraction(6, 8) };

  // Pattern 2: pitches2 = [62, 63, 62, 58]
  let pattern2 = createPattern();
  const pitches2 = [62, 63, 62, 58];
  pitches2.forEach((pitch, i) => {
    const note = createNote(pitch, 100, new Fraction(1, 4));
    pattern2 = addNote(pattern2, new Fraction(i, 8), note);
  });
  // Set explicit duration: 4/8
  pattern2 = { ...pattern2, duration: new Fraction(4, 8) };

  const nodes: PatternFlowNode[] = [
    // Pattern sources
    {
      id: 'pattern-1',
      type: 'pattern-source',
      position: { x: 100, y: 150 },
      data: {
        type: 'pattern-source',
        name: 'Pattern 1',
        pattern: pattern1,
      },
    },
    {
      id: 'pattern-2',
      type: 'pattern-source',
      position: { x: 100, y: 400 },
      data: {
        type: 'pattern-source',
        name: 'Pattern 2',
        pattern: pattern2,
      },
    },

    // First concat: pattern1112 = Concat(pattern1, pattern1, pattern1, pattern2)
    {
      id: 'concat-1112',
      type: 'modifier',
      position: { x: 400, y: 250 },
      data: {
        type: 'modifier',
        modifierType: 'concat',
        params: { modifier: 'concat' },
        positionalInputCount: 4,
        name: 'Concat 1',
      },
    },

    // Reverse the pattern1112
    {
      id: 'reverse-1',
      type: 'modifier',
      position: { x: 700, y: 150 },
      data: {
        type: 'modifier',
        modifierType: 'reverse',
        params: { modifier: 'reverse' },
        name: 'Reverse 1',
      },
    },

    // Invert the reversed pattern (pivot=60)
    {
      id: 'invert-1',
      type: 'modifier',
      position: { x: 950, y: 150 },
      data: {
        type: 'modifier',
        modifierType: 'invert',
        params: { modifier: 'invert', pivot: 60 },
        name: 'Invert 1',
      },
    },

    // Final concat: pattern1112f = Concat(pattern1112, Invert(Reverse(pattern1112)))
    {
      id: 'concat-final',
      type: 'modifier',
      position: { x: 1200, y: 250 },
      data: {
        type: 'modifier',
        modifierType: 'concat',
        params: { modifier: 'concat' },
        positionalInputCount: 2,
        name: 'Concat 2',
      },
    },
  ];

  const edges = [
    // Build pattern1112 = Concat(pattern1, pattern1, pattern1, pattern2)
    { id: 'e1', source: 'pattern-1', target: 'concat-1112', targetHandle: 'pos-0' },
    { id: 'e2', source: 'pattern-1', target: 'concat-1112', targetHandle: 'pos-1' },
    { id: 'e3', source: 'pattern-1', target: 'concat-1112', targetHandle: 'pos-2' },
    { id: 'e4', source: 'pattern-2', target: 'concat-1112', targetHandle: 'pos-3' },
    
    // Build inverted reverse: Reverse -> Invert
    { id: 'e5', source: 'concat-1112', target: 'reverse-1', targetHandle: 'pattern' },
    { id: 'e6', source: 'reverse-1', target: 'invert-1', targetHandle: 'pattern' },
    
    // Final concatenation: Concat(pattern1112, inverted-reverse)
    { id: 'e7', source: 'concat-1112', target: 'concat-final', targetHandle: 'pos-0' },
    { id: 'e8', source: 'invert-1', target: 'concat-final', targetHandle: 'pos-1' },
  ];

  return { nodes, edges };
}
