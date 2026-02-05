/**
 * Piano Roll - Main canvas showing grid and notes
 * References Timeline.tsx architecture: canvas for grid, React components for notes
 */
import { useEffect, useRef, useState } from 'react';
import Fraction from 'fraction.js';
import { PianoKeys } from './PianoKeys';
import { PianoRollNote } from './PianoRollNote';
import { usePianoRollSelection } from './usePianoRollSelection';
import { usePianoRollDraw } from './usePianoRollDraw';
import { useSettingsStore } from '@/store/settingsStore';
import { midiManager } from '@/engine';
import type { Note } from '@/types/midi';

interface PianoRollProps {
  pattern: Array<[Fraction, Note]>; // [startTime, note] tuples
  pixelsPerBeat: number;
  activeTool: 'draw' | 'select';
  snapTime: (time: Fraction) => Fraction;
  patternDuration: Fraction | null;
  onPatternDurationChange: (duration: Fraction) => void;
  selectedNoteIndices: number[];
  onSelectNotes: (indices: number[]) => void;
  onClearSelection: () => void;
  onNoteAdd: (startTime: Fraction, note: Note) => void;
  onNoteEdit: (index: number, startTime: Fraction, note: Note) => void;
  onNotesEdit: (updates: Array<{ index: number; startTime: Fraction; note: Note }>) => void;
  onNoteDelete: (index: number) => void;
  defaultDuration: Fraction;
  defaultVelocity: number;
}

export function PianoRoll({
  pattern,
  pixelsPerBeat,
  activeTool,
  snapTime,
  patternDuration,
  onPatternDurationChange,
  selectedNoteIndices,
  onSelectNotes,
  onClearSelection,
  onNoteAdd,
  onNoteEdit,
  onNotesEdit,
  onNoteDelete,
  defaultDuration,
  defaultVelocity,
}: PianoRollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const { patternEditorLeftBorder, patternEditorRightBorder, beatsPerMeasure } = useSettingsStore();

  // Fixed note height and practical MIDI range (A0 to C8 - 88 piano keys)
  const pixelsPerNote = 20;
  const minNote = 21; // A0
  const maxNote = 108; // C8
  const noteRange = maxNote - minNote + 1; // 88 notes

  // Calculate dimensions based on canvas borders (borders are in measures, convert to beats)
  const canvasOffsetBeats = patternEditorLeftBorder * beatsPerMeasure;
  const canvasTotalBeats = (patternEditorRightBorder - patternEditorLeftBorder) * beatsPerMeasure;
  const totalWidth = canvasTotalBeats * pixelsPerBeat;
  const totalHeight = noteRange * pixelsPerNote;
  const totalMeasures = patternEditorRightBorder - patternEditorLeftBorder;

  const playPreviewNote = (noteNumber: number, velocity: number = 80) => {
    if (!Number.isFinite(noteNumber)) return;
    const clampedVelocity = Math.max(1, Math.min(127, Math.round(velocity)));
    midiManager.sendNoteOn(0, noteNumber, clampedVelocity);
    window.setTimeout(() => {
      midiManager.sendNoteOff(0, noteNumber, clampedVelocity);
    }, 180);
  };

  // Use selection and draw hooks (like Timeline)
  const selection = usePianoRollSelection({
    pattern,
    selectedNoteIndices,
    selectNotes: onSelectNotes,
    clearSelection: onClearSelection,
    pixelsPerBeat,
    pixelsPerNote,
    canvasOffsetBeats,
    maxNote,
  });

  const draw = usePianoRollDraw({
    pattern,
    addNote: onNoteAdd,
    updateNote: onNoteEdit,
    updateNotes: onNotesEdit,
    pixelsPerBeat,
    pixelsPerNote,
    canvasOffsetBeats,
    minNote,
    maxNote,
    snapTime,
  });

  // Handle canvas mouse down - only for region selection
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    if (activeTool === 'select') {
      // Start region selection
      selection.startRegionSelection(x, y);
    }
  };

  // Handle canvas click - add note in draw mode (like Timeline's handleGridClick)
  const handleCanvasClick = (e: React.MouseEvent) => {
    // Don't place if we were dragging or in select mode
    if (draw.isDragging || activeTool === 'select') return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    // Add note at click position
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;

    const rawTime = new Fraction((x / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
    const time = snapTime(rawTime);
    const noteNumber = Math.max(minNote, Math.min(maxNote, maxNote - Math.floor(y / pixelsPerNote)));

    playPreviewNote(noteNumber, defaultVelocity);

    onNoteAdd(time, {
      note: noteNumber,
      velocity: defaultVelocity,
      duration: defaultDuration,
    });
  };

  // Handle note mouse down - select and prepare drag (ALWAYS, regardless of tool)
  const handleNoteMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click

    // Calculate which indices to drag (same logic as selectSingleNote)
    // If clicking already selected note, drag all selected; otherwise drag only this note
    const indicesToDrag = selectedNoteIndices.includes(index) 
      ? selectedNoteIndices 
      : [index];

    // Select the note immediately (if not already selected)
    selection.selectSingleNote(index);

    // Always prepare for drag (like Timeline does)
    const [startTime, note] = pattern[index];
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const noteX = (startTime.valueOf() * 4 - canvasOffsetBeats) * pixelsPerBeat;
    const noteY = (maxNote - note.note) * pixelsPerNote;

    draw.startNoteDrag(index, indicesToDrag, e.clientX, e.clientY, rect, noteX, noteY, scrollLeft, scrollTop);
  };

  // Handle note resize start (right edge drag)
  const handleNoteResizeStart = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click

    draw.startNoteResize(index, e.clientX, e.clientY);
  };

  // Handle note right-click - delete
  const handleNoteContextMenu = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    onNoteDelete(index);
  };

  // Handle mouse move for drag and region selection
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    // Region selection mode
    if (selection.selectionRect && activeTool === 'select') {
      const x = e.clientX - rect.left + scrollLeft;
      const y = e.clientY - rect.top + scrollTop;
      selection.updateRegionSelection(x, y);
      return;
    }

    // Handle dragging notes
    if (draw.drawState) {
      draw.handleDragMove(e.clientX, e.clientY, rect, scrollLeft, scrollTop);
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    // Finalize region selection
    if (selection.selectionRect && activeTool === 'select') {
      selection.finalizeRegionSelection();
    }

    if (draw.drawState?.noteIndex !== undefined && (draw.drawState.type === 'drag' || draw.drawState.type === 'resize')) {
      const [, note] = pattern[draw.drawState.noteIndex] ?? [];
      if (note) {
        playPreviewNote(note.note, note.velocity);
      }
    }

    // End drag
    draw.endDrag();
  };

  // Draw grid (adapted from Timeline.tsx)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = totalWidth * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Horizontal lines (MIDI notes)
    for (let note = minNote; note <= maxNote; note++) {
      const y = (maxNote - note) * pixelsPerNote;
      const isBlackKey = [1, 3, 6, 8, 10].includes(note % 12);
      const isOctave = note % 12 === 0;

      // Background stripe for black keys
      if (isBlackKey) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, y, totalWidth, pixelsPerNote);
      }

      // Grid line
      ctx.strokeStyle = isOctave ? '#374151' : '#1f2937';
      ctx.lineWidth = isOctave ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalWidth, y);
      ctx.stroke();
    }

    // Vertical lines (beats and measures) - use beatsPerMeasure from settings
    const startBeat = Math.floor(canvasOffsetBeats);
    const endBeat = Math.ceil(canvasOffsetBeats + canvasTotalBeats);

    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = (beat - canvasOffsetBeats) * pixelsPerBeat;
      const isMeasure = beat % beatsPerMeasure === 0;

      ctx.strokeStyle = isMeasure ? '#4b5563' : '#1f2937';
      ctx.lineWidth = isMeasure ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, totalHeight);
      ctx.stroke();
    }
  }, [totalWidth, totalHeight, pixelsPerBeat, pixelsPerNote, canvasOffsetBeats, canvasTotalBeats, beatsPerMeasure]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const RULER_HEIGHT = 32;
  const fallbackDuration = pattern.length > 0
    ? new Fraction(
        Math.max(
          ...pattern.map(([startTime, note]) => startTime.valueOf() + note.duration.valueOf())
        )
      )
    : new Fraction(0);
  const durationTime = patternDuration ?? fallbackDuration;
  const durationBeat = durationTime.valueOf() * 4;
  const durationX = (durationBeat - canvasOffsetBeats) * pixelsPerBeat;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Ruler */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        {/* Piano keys header */}
        <div className="w-15 flex items-center justify-center text-xs text-gray-400 border-r border-gray-700" style={{ height: `${RULER_HEIGHT}px` }}>
          Notes
        </div>
        
        {/* Ruler markers */}
        <div 
          className="flex-1 relative overflow-hidden cursor-pointer" 
          style={{ height: `${RULER_HEIGHT}px` }}
          ref={rulerRef}
          onClick={(e) => {
            const rect = rulerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left + scrollLeft;
            const rawTime = new Fraction((x / pixelsPerBeat / 4) + (canvasOffsetBeats / 4));
            const time = snapTime(rawTime);
            if (time) onPatternDurationChange(time);
          }}
        >
          <div 
            className="relative h-full"
            style={{ 
              width: `${totalWidth}px`,
              transform: `translateX(-${scrollLeft}px)`,
            }}
          >
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{ left: `${durationX}px` }}
            >
              <div className="absolute top-0 bottom-0 w-px bg-red-400/70" />
              <div
                className="absolute -top-1 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 border border-red-200 shadow"
                title="Pattern duration"
              />
            </div>
            {Array.from({ length: totalMeasures + 1 }, (_, measureIndex) => {
              const measure = patternEditorLeftBorder + measureIndex;
              const beat = measure * beatsPerMeasure;
              const x = (beat - canvasOffsetBeats) * pixelsPerBeat;
              
              return (
                <div
                  key={measureIndex}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${x}px` }}
                >
                  {/* Tick mark */}
                  <div 
                    className="absolute bottom-0 h-4 bg-gray-400"
                    style={{ width: '1px' }}
                  />
                  
                  {/* Label for measures */}
                  <div className="absolute bottom-4 left-1 text-xs text-gray-400 font-mono">
                    {measure}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Piano Keys Sidebar */}
        <PianoKeys
          pixelsPerNote={pixelsPerNote}
          totalHeight={totalHeight}
          scrollTop={scrollTop}
          minNote={minNote}
          maxNote={maxNote}
        />

        {/* Scrollable Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto relative"
        onScroll={handleScroll}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        {/* Grid Canvas */}
        <canvas
          ref={canvasRef}
          className="block"
        />
        
        {/* Notes Layer (React components like Timeline) */}
        <div className="absolute top-0 left-0 pointer-events-auto">
          {pattern.map(([startTime, note], index) => (
            <PianoRollNote
              key={index}
              startTime={startTime}
              note={note}
              pixelsPerBeat={pixelsPerBeat}
              pixelsPerNote={pixelsPerNote}
              canvasOffsetBeats={canvasOffsetBeats}
              maxNote={maxNote}
              isSelected={selectedNoteIndices.includes(index)}
              onMouseDown={(e) => handleNoteMouseDown(e, index)}
              onContextMenu={(e) => handleNoteContextMenu(e, index)}
              onResizeStart={(e) => handleNoteResizeStart(e, index)}
            />
          ))}
        </div>
        
        {/* Selection rectangle */}
        {selection.selectionRect && activeTool === 'select' && (
          <div
            className="absolute pointer-events-none border-2 border-blue-400 bg-blue-600/20"
            style={{
              left: `${Math.min(selection.selectionRect.startX, selection.selectionRect.endX)}px`,
              top: `${Math.min(selection.selectionRect.startY, selection.selectionRect.endY)}px`,
              width: `${Math.abs(selection.selectionRect.endX - selection.selectionRect.startX)}px`,
              height: `${Math.abs(selection.selectionRect.endY - selection.selectionRect.startY)}px`,
            }}
          />
        )}
      </div>
      </div>
    </div>
  );
}
