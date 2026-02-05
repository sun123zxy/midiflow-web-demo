/**
 * Piano Roll Note - Individual note component (like TimelineItem)
 */
import type { Note } from '@/types/midi';
import type Fraction from 'fraction.js';

interface PianoRollNoteProps {
  startTime: Fraction;
  note: Note;
  pixelsPerBeat: number;
  pixelsPerNote: number;
  canvasOffsetBeats: number;
  maxNote: number;
  isSelected?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onResizeStart?: (e: React.MouseEvent) => void;
}

export function PianoRollNote({
  startTime,
  note,
  pixelsPerBeat,
  pixelsPerNote,
  canvasOffsetBeats,
  maxNote,
  isSelected = false,
  onMouseDown,
  onContextMenu,
  onResizeStart,
}: PianoRollNoteProps) {
  const x = (startTime.valueOf() * 4 - canvasOffsetBeats) * pixelsPerBeat;
  const width = note.duration.valueOf() * 4 * pixelsPerBeat;
  const y = (maxNote - note.note) * pixelsPerNote;
  const height = pixelsPerNote;

  // Velocity-based opacity (like Timeline)
  const velocityRatio = note.velocity / 127;
  const opacity = 0.2 + velocityRatio * 0.8; // 0.2 to 1.0

  return (
    <div
      className={`absolute cursor-pointer rounded select-none ${
        isSelected 
          ? 'border border-blue-400 bg-purple-600 hover:bg-purple-500' 
          : 'border border-gray-600 bg-purple-600 hover:bg-purple-500'
      } transition-colors`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        opacity,
        boxSizing: 'border-box',
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Resize handle on right edge */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart?.(e);
        }}
      />
    </div>
  );
}
