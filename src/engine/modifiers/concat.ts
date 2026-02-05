import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { createPattern, calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * Concat - Concatenate patterns end-to-end
 */
export function concat(...patterns: Pattern[]): Pattern {
  if (patterns.length === 0) return createPattern();
  
  const allNotes: Array<[Fraction, Note]> = [];
  let currentTime = new Fraction(0);
  
  for (const pattern of patterns) {
    for (const [startTime, note] of pattern.notes) {
      allNotes.push([currentTime.add(startTime), note]);
    }
    const patternDuration = pattern.duration ?? calculateDuration(pattern.notes);
    currentTime = currentTime.add(patternDuration);
  }
  
  return createPatternWithBounds(
    allNotes,
    currentTime
  );
}

// Register the modifier
registerModifier({
  name: 'concat',
  displayName: 'Concat',
  inputs: [{
    type: 'positional',
    minCount: 2,
    label: 'Patterns',
  }],
  execute: ({ positional }) => concat(...positional!),
  parameters: {},
});
