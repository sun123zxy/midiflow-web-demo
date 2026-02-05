import type { Pattern, Note } from '@/types';
import { calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import Fraction from 'fraction.js';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * Trim - Remove notes outside [0, duration) range
 */
export function trim(pattern: Pattern, trimEnd: boolean = true): Pattern {
  const duration = pattern.duration ?? calculateDuration(pattern.notes);
  const newNotes: Array<[Fraction, Note]> = [];
  
  for (const [startTime, note] of pattern.notes) {
    // Skip notes before 0 or after duration
    if (startTime.compare(0) < 0 || startTime.compare(duration) >= 0) {
      continue;
    }
    
    // Optionally trim notes that extend past duration
    if (trimEnd) {
      const endTime = startTime.add(note.duration);
      if (endTime.compare(duration) > 0) {
        const newDuration = duration.sub(startTime);
        if (newDuration.compare(0) > 0) {
          newNotes.push([startTime, { ...note, duration: newDuration }]);
        }
      } else {
        newNotes.push([startTime, note]);
      }
    } else {
      newNotes.push([startTime, note]);
    }
  }
  
  return createPatternWithBounds(
    newNotes,
    duration
  );
}

// Register the modifier
registerModifier({
  name: 'trim',
  displayName: 'Trim',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => trim(keyword!.pattern, params.trimEnd),
  parameters: {
    trimEnd: {
      type: 'boolean',
      defaultValue: false,
      label: 'Trim End',
      description: 'Cut notes that extend past pattern duration',
    },
  },
});
