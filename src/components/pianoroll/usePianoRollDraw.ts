import { useState } from 'react';
import Fraction from 'fraction.js';
import type { Note } from '@/types/midi';

interface DrawState {
  type: 'draw' | 'drag' | 'resize';
  noteIndex?: number;
}

interface MousePos {
  x: number;
  y: number;
}

interface DragOffset {
  x: number;
  y: number;
}

// Store original note positions at drag start
interface OriginalNotePosition {
  time: Fraction;
  note: number;
  duration: Fraction;
  velocity: number;
}

interface UsePianoRollDrawProps {
  pattern: Array<[Fraction, Note]>;
  addNote: (startTime: Fraction, note: Note) => void;
  updateNote: (index: number, startTime: Fraction, note: Note) => void;
  updateNotes: (updates: Array<{ index: number; startTime: Fraction; note: Note }>) => void;
  pixelsPerBeat: number;
  pixelsPerNote: number;
  canvasOffsetBeats: number;
  minNote: number;
  maxNote: number;
  snapTime: (time: Fraction) => Fraction;
}

export function usePianoRollDraw({
  pattern,
  addNote,
  updateNote,
  updateNotes,
  pixelsPerBeat,
  pixelsPerNote,
  canvasOffsetBeats,
  minNote,
  maxNote,
  snapTime,
}: UsePianoRollDrawProps) {
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<MousePos | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [drawNoteStart, setDrawNoteStart] = useState<{ time: Fraction; note: number } | null>(null);
  // Store original positions of all selected notes at drag start
  const [originalPositions, setOriginalPositions] = useState<Map<number, OriginalNotePosition>>(new Map());

  // Start drawing a new note
  const startDrawing = (clientX: number, clientY: number, containerRect: DOMRect, scrollX: number, scrollTop: number) => {
    const x = clientX - containerRect.left + scrollX;
    const y = clientY - containerRect.top + scrollTop;

    const rawTime = new Fraction((x / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
    const time = snapTime(rawTime);
    const noteNumber = Math.max(minNote, Math.min(maxNote, maxNote - Math.floor(y / pixelsPerNote)));

    setDrawNoteStart({ time, note: noteNumber });
    setDrawState({ type: 'draw' });
  };

  // Update drawing (drag to set note length)
  const updateDrawing = (clientX: number, containerRect: DOMRect, scrollX: number) => {
    if (!drawNoteStart || !drawState || drawState.type !== 'draw') return;

    const x = clientX - containerRect.left + scrollX;
    const rawTime = new Fraction((x / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
    const endTime = snapTime(rawTime);
    
    // Calculate duration (minimum 1/16 beat)
    let duration = endTime.sub(drawNoteStart.time);
    if (duration.valueOf() < 0.0625) {
      duration = new Fraction(1, 16);
    }

    return { startTime: drawNoteStart.time, duration, note: drawNoteStart.note };
  };

  // Finalize drawing
  const finalizeDrawing = (clientX: number, containerRect: DOMRect, scrollX: number) => {
    if (!drawNoteStart || !drawState || drawState.type !== 'draw') return;

    const noteInfo = updateDrawing(clientX, containerRect, scrollX);
    if (noteInfo) {
      addNote(noteInfo.startTime, {
        note: noteInfo.note,
        velocity: 80,
        duration: noteInfo.duration,
      });
    }

    setDrawNoteStart(null);
    setDrawState(null);
  };

  // Start dragging an existing note
  // indicesToDrag should be passed explicitly since React state updates are async
  const startNoteDrag = (noteIndex: number, indicesToDrag: number[], clientX: number, clientY: number, containerRect: DOMRect, noteX: number, noteY: number, scrollX: number, scrollTop: number) => {
    setMouseDownPos({ x: clientX, y: clientY });
    setDragOffset({
      x: clientX - containerRect.left - noteX + scrollX,
      y: clientY - containerRect.top - noteY + scrollTop,
    });
    setDrawState({ type: 'drag', noteIndex });
    
    // Store original positions of all notes to drag
    const positions = new Map<number, OriginalNotePosition>();
    
    indicesToDrag.forEach(idx => {
      const [time, note] = pattern[idx];
      positions.set(idx, {
        time,
        note: note.note,
        duration: note.duration,
        velocity: note.velocity,
      });
    });
    setOriginalPositions(positions);
  };

  // Start resizing a note (dragging right edge)
  const startNoteResize = (noteIndex: number, clientX: number, clientY: number) => {
    setMouseDownPos({ x: clientX, y: clientY });
    setDrawState({ type: 'resize', noteIndex });
    
    // Store original position of the note being resized
    const [time, note] = pattern[noteIndex];
    const positions = new Map<number, OriginalNotePosition>();
    positions.set(noteIndex, {
      time,
      note: note.note,
      duration: note.duration,
      velocity: note.velocity,
    });
    setOriginalPositions(positions);
  };

  // Handle drag movement
  const handleDragMove = (clientX: number, clientY: number, containerRect: DOMRect, scrollX: number, scrollTop: number) => {
    if (!drawState) return;

    const x = clientX - containerRect.left + scrollX;
    const y = clientY - containerRect.top + scrollTop;

    // Check if we should start dragging (3px threshold)
    if (mouseDownPos && !isDragging) {
      const dx = clientX - mouseDownPos.x;
      const dy = clientY - mouseDownPos.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        return; // Not enough movement
      }
    }

    setIsDragging(true);
    setMouseDownPos(null);

    // Calculate new position
    const dragX = x - dragOffset.x;
    const dragY = y - dragOffset.y;

    const rawTime = new Fraction((dragX / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
    const time = snapTime(rawTime);
    const noteNumber = Math.max(minNote, Math.min(maxNote, maxNote - Math.floor(dragY / pixelsPerNote)));

    if (drawState.type === 'drag' && drawState.noteIndex !== undefined) {
      // Get the dragged note's ORIGINAL position (stored at drag start)
      const originalDragged = originalPositions.get(drawState.noteIndex);
      if (!originalDragged) return;
      
      // Calculate delta from original position
      const deltaTime = time.sub(originalDragged.time);
      const deltaNote = noteNumber - originalDragged.note;

      // Batch update all selected notes using their original positions
      const updates: Array<{ index: number; startTime: Fraction; note: Note }> = [];
      originalPositions.forEach((original, index) => {
        const newTime = original.time.add(deltaTime);
        const newNote = Math.max(minNote, Math.min(maxNote, original.note + deltaNote));
        updates.push({
          index,
          startTime: newTime,
          note: {
            note: newNote,
            velocity: original.velocity,
            duration: original.duration,
          },
        });
      });
      updateNotes(updates);
    }

    // Handle resize
    if (drawState.type === 'resize' && drawState.noteIndex !== undefined) {
      const original = originalPositions.get(drawState.noteIndex);
      if (!original) return;

      // Calculate new end time based on mouse position
      const rawEndTime = new Fraction((x / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
      const endTime = snapTime(rawEndTime);
      
      // Duration = endTime - startTime (minimum 1/16 beat)
      let newDuration = endTime.sub(original.time);
      if (newDuration.valueOf() < 0.0625) {
        newDuration = new Fraction(1, 16);
      }

      updateNote(drawState.noteIndex, original.time, {
        note: original.note,
        velocity: original.velocity,
        duration: newDuration,
      });
    }
  };

  // End drag
  const endDrag = () => {
    setDrawState(null);
    setDrawNoteStart(null);
    setDragOffset({ x: 0, y: 0 });
    setMouseDownPos(null);
    setOriginalPositions(new Map());
    // Clear isDragging after short delay to prevent click event
    if (isDragging) {
      setTimeout(() => setIsDragging(false), 100);
    }
  };

  return {
    drawState,
    isDragging,
    drawNoteStart,
    startDrawing,
    updateDrawing,
    finalizeDrawing,
    startNoteDrag,
    startNoteResize,
    handleDragMove,
    endDrag,
  };
}
