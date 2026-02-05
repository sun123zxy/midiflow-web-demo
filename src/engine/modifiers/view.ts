import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { calculateDuration } from '@/engine/pattern';
import { createPatternWithBounds } from '@/engine/pattern';
import { registerModifier } from '@/engine/modifierRegistry';

/**
 * View - Adjust time window of the pattern
 */
export function view(
  pattern: Pattern,
  startTime: Fraction | number,
  endTime?: Fraction | number | null
): Pattern {
  const start = startTime instanceof Fraction ? startTime : new Fraction(startTime);
  const patternDuration = pattern.duration ?? calculateDuration(pattern.notes);
  const end = endTime
    ? endTime instanceof Fraction
      ? endTime
      : new Fraction(endTime)
    : patternDuration;
  
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([time, note]) => [
    time.sub(start),
    note,
  ]);
  
  return createPatternWithBounds(
    newNotes,
    end.sub(start)
  );
}

// Register the modifier
registerModifier({
  name: 'view',
  displayName: 'View',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => {
    return view(keyword!.pattern, params.startTime, params.endTime);
  },
  parameters: {
    startTime: {
      type: 'fraction',
      defaultValue: new Fraction(0),
      label: 'Start Time',
      description: 'Start of the time window',
      unit: 'beats',
    },
    endTime: {
      type: 'fraction',
      defaultValue: null,
      label: 'End Time',
      description: 'End of the time window',
      unit: 'beats',
    },
  },
});
