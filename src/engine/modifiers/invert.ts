import type { Pattern, Note } from '@/types';
import Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * Invert - Invert pitches around a pivot note
 */
export function invert(pattern: Pattern, pivot: number): Pattern {
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    {
      ...note,
      note: Math.max(0, Math.min(127, 2 * pivot - note.note)),
    },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'invert',
  displayName: 'Invert',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => invert(keyword!.pattern, params.pivot),
  parameters: {
    pivot: {
      type: 'midi-note',
      defaultValue: 60,
      label: 'Pivot Note',
      description: 'Center point for inversion',
    },
  },
});
