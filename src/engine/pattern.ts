import Fraction from 'fraction.js';
import type { Note, Pattern, PatternBounds } from '@/types';

/**
 * Calculate bounds for a pattern (cached for performance)
 */
export function calculatePatternBounds(notes: Array<[Fraction, Note]>): PatternBounds | undefined {
  if (notes.length === 0) return undefined;
  
  let minPitch = 127;
  let maxPitch = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;

  notes.forEach(([startTime, note]) => {
    const pitch = note.note;
    const time = startTime.valueOf();
    const endTime = time + note.duration.valueOf();

    minPitch = Math.min(minPitch, pitch);
    maxPitch = Math.max(maxPitch, pitch);
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, endTime);
  });

  return { minPitch, maxPitch, minTime, maxTime };
}

/**
 * Create a pattern with pre-calculated bounds (used by modifiers)
 */
export function createPatternWithBounds(notes: Array<[Fraction, Note]>, duration: Fraction | null): Pattern {
  const pattern: Pattern = {
    notes,
    duration,
  };
  pattern.bounds = calculatePatternBounds(notes);
  return pattern;
}

/**
 * Create a new note
 */
export function createNote(
  note: number,
  velocity: number = 64,
  duration: Fraction | number = new Fraction(1, 4)
): Note {
  const dur = duration instanceof Fraction ? duration : new Fraction(duration);
  return {
    duration: dur,
    note,
    velocity,
  };
}

/**
 * Create a new empty pattern
 */
export function createPattern(duration?: Fraction | null, name?: string): Pattern {
  const pattern: Pattern = {
    notes: [],
    duration: duration ?? null,
    name,
  };
  pattern.bounds = calculatePatternBounds(pattern.notes);
  return pattern;
}

/**
 * Add a note to a pattern at a specific start time
 */
export function addNote(
  pattern: Pattern,
  startTime: Fraction | number,
  note: Note
): Pattern {
  const time = startTime instanceof Fraction ? startTime : new Fraction(startTime);
  const newNotes = [...pattern.notes, [time, note] as [Fraction, Note]];
  
  // Sort by start time
  newNotes.sort((a, b) => a[0].compare(b[0]));
  
  const newPattern: Pattern = {
    ...pattern,
    notes: newNotes,
    duration: pattern.duration ?? calculateDuration(newNotes),
  };
  newPattern.bounds = calculatePatternBounds(newNotes);
  return newPattern;
}

/**
 * Remove a note from a pattern
 */
export function removeNote(
  pattern: Pattern,
  startTime: Fraction,
  noteIndex?: number
): Pattern {
  let newNotes = pattern.notes;
  
  if (noteIndex !== undefined) {
    // Remove specific note at time and index
    newNotes = pattern.notes.filter((_, idx) => idx !== noteIndex);
  } else {
    // Remove all notes at given start time
    newNotes = pattern.notes.filter(([time]) => !time.equals(startTime));
  }
  
  const newPattern: Pattern = {
    ...pattern,
    notes: newNotes,
    duration: pattern.duration ?? calculateDuration(newNotes),
  };
  newPattern.bounds = calculatePatternBounds(newNotes);
  return newPattern;
}

/**
 * Calculate pattern duration from notes
 */
export function calculateDuration(notes: Array<[Fraction, Note]>): Fraction {
  if (notes.length === 0) return new Fraction(0);
  
  let maxEndTime = new Fraction(0);
  for (const [startTime, note] of notes) {
    const endTime = startTime.add(note.duration);
    if (endTime.compare(maxEndTime) > 0) {
      maxEndTime = endTime;
    }
  }
  
  return maxEndTime;
}

/**
 * Get the real start time (earliest note time, can be negative)
 */
export function getRealStartTime(pattern: Pattern): Fraction {
  if (pattern.notes.length === 0) return new Fraction(0);
  
  let minTime = pattern.notes[0][0];
  for (const [startTime] of pattern.notes) {
    if (startTime.compare(minTime) < 0) {
      minTime = startTime;
    }
  }
  
  return minTime;
}

/**
 * Get the real end time (latest note end time)
 */
export function getRealEndTime(pattern: Pattern): Fraction {
  if (pattern.notes.length === 0) return new Fraction(0);
  
  let maxEndTime = new Fraction(0);
  for (const [startTime, note] of pattern.notes) {
    const endTime = startTime.add(note.duration);
    if (endTime.compare(maxEndTime) > 0) {
      maxEndTime = endTime;
    }
  }
  
  return maxEndTime;
}

/**
 * Set pattern duration explicitly
 */
export function setDuration(pattern: Pattern, duration: Fraction | number): Pattern {
  const dur = duration instanceof Fraction ? duration : new Fraction(duration);
  return {
    ...pattern,
    duration: dur,
  };
}

/**
 * Clone a pattern
 */
export function clonePattern(pattern: Pattern): Pattern {
  return {
    ...pattern,
    notes: pattern.notes.map(([time, note]) => [
      new Fraction(time.n, time.d),
      { ...note, duration: new Fraction(note.duration.n, note.duration.d) },
    ]),
    duration: pattern.duration ? new Fraction(pattern.duration.n, pattern.duration.d) : null,
  };
}
