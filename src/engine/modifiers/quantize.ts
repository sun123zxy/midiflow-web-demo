import Fraction from 'fraction.js';
import type { Pattern, Note } from '@/types';
import { registerModifier } from '@/engine/modifierRegistry';
import { createPatternWithBounds, calculateDuration } from '@/engine/pattern';

/**
 * Quantize - Snap note start times to grid
 */
export function quantize(pattern: Pattern, gridSize: Fraction | number): Pattern {
  const grid = gridSize instanceof Fraction ? gridSize : new Fraction(gridSize);
  const newNotes: Array<[Fraction, Note]> = pattern.notes.map(([startTime, note]) => {
    // Round to nearest grid position
    const gridPos = startTime.div(grid).round();
    const quantizedTime = grid.mul(gridPos);
    return [quantizedTime, note];
  });
  
  // Sort by start time
  newNotes.sort((a, b) => a[0].compare(b[0]));
  
  return createPatternWithBounds(
    newNotes,
    pattern.duration ?? calculateDuration(newNotes)
  );
}

// Register the modifier
registerModifier({
  name: 'quantize',
  displayName: 'Quantize',
  inputs: [{
    type: 'keyword',
    key: 'pattern',
    label: 'Input',
    required: true,
  }],
  execute: ({ keyword }, params) => quantize(keyword!.pattern, params.grid),
  parameters: {
    grid: {
      type: 'fraction',
      defaultValue: new Fraction(1, 4),
      label: 'Grid Size',
      description: 'Quantization grid resolution',
      unit: 'beats',
    },
  },
});
