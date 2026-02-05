import type { Pattern, Note } from '@/types';
import { calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import type Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * Reverse - Reverse the time axis
 */
export function reverse(pattern: Pattern): Pattern {
  const duration = pattern.duration ?? calculateDuration(pattern.notes);
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => [
    duration.sub(startTime).sub(note.duration),
    note,
  ]);
  
  // Sort by start time
  newNotes.sort((a, b) => a[0].compare(b[0]));
  
  return createPatternWithBounds(
    newNotes,
    duration
  );
}

// Register the modifier
registerModifier({
  name: 'reverse',
  displayName: 'Reverse',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }) => reverse(keyword!.pattern),
  parameters: {},
});
