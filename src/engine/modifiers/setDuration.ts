import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * SetDuration - Set all note durations to a fixed value
 */
export function setDuration(pattern: Pattern, duration: Fraction | number): Pattern {
  const dur = duration instanceof Fraction ? duration : new Fraction(duration);
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    { ...note, duration: dur },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'setDuration',
  displayName: 'Set Duration',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => setDuration(keyword!.pattern, params.duration),
  parameters: {
    duration: {
      type: 'fraction',
      defaultValue: new Fraction(1, 4),
      label: 'Duration',
      description: 'Fixed note duration',
      unit: 'beats',
    },
  },
});
