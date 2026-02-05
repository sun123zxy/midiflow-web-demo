import type { Pattern, Note } from '@/types';
import Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * SetVelocity - Set all note velocities to a fixed value
 */
export function setVelocity(pattern: Pattern, velocity: number): Pattern {
  const vel = Math.max(0, Math.min(127, velocity));
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    startTime,
    { ...note, velocity: vel },
  ]);
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'setVelocity',
  displayName: 'Set Velocity',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => setVelocity(keyword!.pattern, params.velocity),
  parameters: {
    velocity: {
      type: 'midi-128',
      defaultValue: 80,
      label: 'Velocity',
      description: 'Fixed velocity value (0-127)',
    },
  },
});
