import { useEffect, useRef } from 'react';
import type { Pattern } from '@/types';

interface PatternPreviewProps {
  pattern: Pattern | null;
  width: number;
  height: number;
  timeScale?: number; // pixels per beat (for timeline mode), undefined = auto-fit
  timeOffset?: number; // time offset for rendering (in whole notes) - where to start rendering from
  showBoundaries?: boolean; // show 0 and duration markers
  className?: string;
}

export function PatternPreview({
  pattern,
  width,
  height,
  timeScale,
  timeOffset: externalTimeOffset,
  showBoundaries = true,
  className = '',
}: PatternPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern || pattern.notes.length === 0) {
      // Clear canvas if no pattern
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
        }
      }
      return;
    }

    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size accounting for device pixel ratio
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas (transparent)
    ctx.clearRect(0, 0, width, height);

    // Calculate note bounds - use cached bounds if available for performance
    const notes = pattern.notes;
    let minPitch: number;
    let maxPitch: number;
    let minTime: number;
    let maxTime: number;

    if (pattern.bounds) {
      // Use cached bounds - avoids iterating through all notes
      ({ minPitch, maxPitch, minTime, maxTime } = pattern.bounds);
    } else {
      // Fallback: calculate bounds (for old patterns without cached bounds)
      minPitch = 127;
      maxPitch = 0;
      minTime = Infinity;
      maxTime = -Infinity;

      notes.forEach(([startTime, note]) => {
        const pitch = note.note;
        const time = startTime.valueOf();
        const endTime = time + note.duration.valueOf();

        minPitch = Math.min(minPitch, pitch);
        maxPitch = Math.max(maxPitch, pitch);
        minTime = Math.min(minTime, time);
        maxTime = Math.max(maxTime, endTime);
      });
    }

    // Add padding to pitch range
    const pitchPadding = Math.max(1, (maxPitch - minPitch) * 0.1);
    minPitch = Math.max(0, minPitch - pitchPadding);
    maxPitch = Math.min(127, maxPitch + pitchPadding);

    // Calculate scaling
    const pitchRange = maxPitch - minPitch || 12; // Default to 1 octave if single note
    const pitchScale = height / pitchRange;

    let horizontalScale: number;
    let timeOffset: number;

    if (timeScale !== undefined) {
      // Timeline mode: use provided scale (pixels per beat)
      horizontalScale = timeScale * 4; // Convert to pixels per whole note
      timeOffset = externalTimeOffset !== undefined ? externalTimeOffset : 0;
    } else {
      // Auto-fit mode: fit all notes in available width
      const timeRange = maxTime - minTime || 1; // Default to 1 beat if single note
      const padding = timeRange * 0.1;
      const totalRange = timeRange + padding * 2;
      horizontalScale = width / totalRange;
      timeOffset = minTime - padding;
    }

    // Draw boundary markers (0 and duration)
    if (showBoundaries && pattern.duration) {
      const duration = pattern.duration.valueOf();
      
      // Zero line (green)
      const zeroX = (-timeOffset) * horizontalScale;
      if (zeroX >= 0 && zeroX <= width) {
        ctx.strokeStyle = '#10b981'; // green-500
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(zeroX, 0);
        ctx.lineTo(zeroX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Duration line (blue)
      const durationX = (duration - timeOffset) * horizontalScale;
      if (durationX >= 0 && durationX <= width) {
        ctx.strokeStyle = '#3b82f6'; // blue-500
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(durationX, 0);
        ctx.lineTo(durationX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Draw notes
    notes.forEach(([startTime, note]) => {
      const time = startTime.valueOf();
      const noteDuration = note.duration.valueOf();
      const pitch = note.note;
      const velocity = note.velocity;

      const x = (time - timeOffset) * horizontalScale;
      const y = height - ((pitch - minPitch) * pitchScale);
      const w = noteDuration * horizontalScale;
      const h = pitchScale * 0.8; // Leave small gap between notes

      // Skip if note is outside visible area
      if (x + w < 0 || x > width) return;

      // Color based on velocity (gradient from dark to bright purple)
      const velocityRatio = velocity / 127;
      const r = Math.floor(100 + velocityRatio * 155); // 100-255
      const g = Math.floor(50 + velocityRatio * 100);  // 50-150
      const b = Math.floor(200 + velocityRatio * 55);  // 200-255
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      // Draw note rectangle
      ctx.fillRect(x, y - h, Math.max(w, 1), h);

      // Subtle border for definition
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y - h, Math.max(w, 1), h);
    });
  }, [pattern, width, height, timeScale, externalTimeOffset, showBoundaries]);

  if (!pattern || pattern.notes.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-800 text-gray-500 text-xs ${className}`}
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        No notes
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: `${width}px`, height: `${height}px` }}
    />
  );
}
