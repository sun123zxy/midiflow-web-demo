import { useState } from 'react';
import type { Note } from '@/types/midi';
import type Fraction from 'fraction.js';

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface UsePianoRollSelectionProps {
  pattern: Array<[Fraction, Note]>;
  selectedNoteIndices: number[];
  selectNotes: (indices: number[]) => void;
  clearSelection: () => void;
  pixelsPerBeat: number;
  pixelsPerNote: number;
  canvasOffsetBeats: number;
  maxNote: number;
}

export function usePianoRollSelection({
  pattern,
  selectedNoteIndices,
  selectNotes,
  clearSelection,
  pixelsPerBeat,
  pixelsPerNote,
  canvasOffsetBeats,
  maxNote,
}: UsePianoRollSelectionProps) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Start region selection
  const startRegionSelection = (x: number, y: number) => {
    setSelectionRect({ startX: x, startY: y, endX: x, endY: y });
  };

  // Update region selection during drag
  const updateRegionSelection = (x: number, y: number) => {
    if (!selectionRect) return;
    setSelectionRect({ ...selectionRect, endX: x, endY: y });
  };

  // Finalize region selection
  const finalizeRegionSelection = () => {
    if (!selectionRect) return;

    const { startX, startY, endX, endY } = selectionRect;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    // Find notes within selection rectangle
    const selectedIndices: number[] = [];
    
    pattern.forEach(([startTime, note], index) => {
      const noteX = (startTime.valueOf() * 4 - canvasOffsetBeats) * pixelsPerBeat;
      const noteY = (maxNote - note.note) * pixelsPerNote;
      const noteWidth = note.duration.valueOf() * 4 * pixelsPerBeat;
      const noteHeight = pixelsPerNote;
      
      // Check intersection
      if (noteX + noteWidth >= minX && noteX <= maxX &&
          noteY + noteHeight >= minY && noteY <= maxY) {
        selectedIndices.push(index);
      }
    });

    // Update selection
    if (selectedIndices.length > 0) {
      selectNotes(selectedIndices);
    } else {
      clearSelection();
    }
    
    setSelectionRect(null);
  };

  // Cancel region selection
  const cancelRegionSelection = () => {
    setSelectionRect(null);
  };

  // Select single note (on mousedown)
  const selectSingleNote = (index: number) => {
    // If clicking an already selected note, keep selection (for multi-drag)
    // Otherwise, select only this note
    if (!selectedNoteIndices.includes(index)) {
      selectNotes([index]);
    }
  };

  return {
    selectionRect,
    startRegionSelection,
    updateRegionSelection,
    finalizeRegionSelection,
    cancelRegionSelection,
    selectSingleNote,
  };
}
