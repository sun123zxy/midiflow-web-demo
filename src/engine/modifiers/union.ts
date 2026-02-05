import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { createPattern, calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * Union - Combine multiple patterns by merging their notes, aligned by start time 0
 */
export function union(...patterns: Pattern[]): Pattern {
  if (patterns.length === 0) return createPattern();
  
  const allNotes: Array<[Fraction, Note]> = [];
  let maxDuration = new Fraction(0);
  
  for (const pattern of patterns) {
    for (const [startTime, note] of pattern.notes) {
      allNotes.push([startTime, note]);
    }
    const patternDuration = pattern.duration ?? calculateDuration(pattern.notes);
    if (patternDuration.compare(maxDuration) > 0) {
      maxDuration = patternDuration;
    }
  }
  
  // Sort by start time
  allNotes.sort((a, b) => a[0].compare(b[0]));
  
  return createPatternWithBounds(
    allNotes,
    maxDuration
  );
}

// Register the modifier
registerModifier({
  name: 'union',
  displayName: 'Union',
  inputs: [{
    type: 'positional',
    minCount: 2,
    label: 'Patterns',
  }],
  execute: ({ positional }) => union(...positional!),
  parameters: {},
});
