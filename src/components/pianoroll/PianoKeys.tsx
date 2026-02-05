/**
 * Piano Keys Sidebar - Left sidebar showing MIDI note names
 */
import { useEffect, useRef } from 'react';

interface PianoKeysProps {
  pixelsPerNote: number;
  totalHeight: number;
  scrollTop: number;
  minNote: number;
  maxNote: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function isBlackKey(note: number): boolean {
  return [1, 3, 6, 8, 10].includes(note % 12);
}

function getNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = NOTE_NAMES[midiNote % 12];
  return `${noteName}${octave}`;
}

export function PianoKeys({ pixelsPerNote, totalHeight, scrollTop, minNote, maxNote }: PianoKeysProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 60; // Fixed width for piano keys
    
    canvas.width = width * dpr;
    canvas.height = totalHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${totalHeight}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, totalHeight);

    // Draw keys (practical MIDI note range, bottom to top)
    for (let note = minNote; note <= maxNote; note++) {
      const y = (maxNote - note) * pixelsPerNote;
      const isBlack = isBlackKey(note);
      const isC = note % 12 === 0;

      // Background color
      ctx.fillStyle = isBlack ? '#1a1a1a' : '#2a2a2a';
      ctx.fillRect(0, y, width, pixelsPerNote);

      // Border
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, y, width, pixelsPerNote);

      // Draw note name for C notes or if space allows
      if (pixelsPerNote >= 16 || isC) {
        ctx.fillStyle = isBlack ? '#9ca3af' : '#d1d5db';
        ctx.font = `${Math.min(pixelsPerNote * 0.6, 10)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(getNoteName(note), width / 2, y + pixelsPerNote / 2);
      }

      // Thicker line for octave boundaries (C notes)
      if (isC) {
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }
  }, [pixelsPerNote, totalHeight]);

  return (
    <div 
      className="relative bg-gray-800 border-r border-gray-700"
      style={{ 
        width: '60px',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `translateY(${-scrollTop}px)`,
        }}
      />
    </div>
  );
}
