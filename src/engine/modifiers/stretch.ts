import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * Stretch - Scale pattern duration by a factor
 */
export function stretch(pattern: Pattern, factor: Fraction | number): Pattern {
  const f = factor instanceof Fraction ? factor : new Fraction(factor);
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime.mul(f),
    { ...note, duration: note.duration.mul(f) },
  ]);
  
  const patternDuration = pattern.duration ?? calculateDuration(pattern.notes);
  
  return createPatternWithBounds(
    newNotes,
    patternDuration.mul(f)
  );
}

// Register the modifier
registerModifier({
  name: 'stretch',
  displayName: 'Stretch',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => stretch(keyword!.pattern, params.factor),
  parameters: {
    factor: {
      type: 'fraction',
      defaultValue: new Fraction(2),
      label: 'Factor',
      description: 'Scale factor for both time and duration',
    },
  },
});
