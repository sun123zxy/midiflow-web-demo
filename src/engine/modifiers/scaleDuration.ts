import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * ScaleDuration - Scale all note durations by a factor (without changing start times)
 */
export function scaleDuration(pattern: Pattern, factor: Fraction | number): Pattern {
  const f = factor instanceof Fraction ? factor : new Fraction(factor);
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    { ...note, duration: note.duration.mul(f) },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'scaleDuration',
  displayName: 'Scale Duration',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => scaleDuration(keyword!.pattern, params.factor),
  parameters: {
    factor: {
      type: 'fraction',
      defaultValue: new Fraction(2),
      label: 'Factor',
      description: 'Scale factor for note durations only',
    },
  },
});
