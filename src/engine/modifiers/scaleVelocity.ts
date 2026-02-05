import type { Pattern, Note } from '@/types';
import Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * ScaleVelocity - Scale all note velocities by a factor
 */
export function scaleVelocity(pattern: Pattern, factor: number): Pattern {
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    {
      ...note,
      velocity: Math.max(0, Math.min(127, Math.round(note.velocity * factor))),
    },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'scaleVelocity',
  displayName: 'Scale Velocity',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => scaleVelocity(keyword!.pattern, params.factor),
  parameters: {
    factor: {
      type: 'slider',
      defaultValue: 1.0,
      range: [0.1, 3.0],
      step: 0.1,
      label: 'Factor',
      description: 'Velocity multiplier',
    },
  },
});
