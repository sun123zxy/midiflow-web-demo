import type { Pattern, Note } from '@/types';
import Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * Transpose - Shift all notes by semitones
 */
export function transpose(pattern: Pattern, semitones: number): Pattern {
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    {
      ...note,
      note: Math.max(0, Math.min(127, note.note + semitones)),
    },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'transpose',
  displayName: 'Transpose',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => transpose(keyword!.pattern, params.semitones),
  parameters: {
    semitones: {
      type: 'slider',
      defaultValue: 0,
      range: [-48, 48],
      step: 1,
      label: 'Semitones',
      description: 'Pitch shift in semitones (12 = one octave)',
    },
  },
});
