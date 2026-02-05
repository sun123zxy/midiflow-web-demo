import Fraction from 'fraction.js';

/**
 * Core MIDI data types for MidiFlow
 */

/**
 * A single MIDI note with duration, pitch, and velocity
 */
export interface Note {
  duration: Fraction;
  note: number; // 0-127 MIDI note number
  velocity: number; // 0-127
}

/**
 * Cached bounds for pattern visualization optimization
 */
export interface PatternBounds {
  minPitch: number;
  maxPitch: number;
  minTime: number;
  maxTime: number;
}

/**
 * A pattern is a collection of notes indexed by their start time
 */
export interface Pattern {
  notes: Array<[Fraction, Note]>; // [startTime, note] tuples, sorted by time
  duration: Fraction | null; // null = auto-calculate from notes
  id?: string;
  name?: string;
  bounds?: PatternBounds; // Cached bounds for performance
}

/**
 * Timeline item - currently only patterns, but extensible for future item types
 */
export type TimelineItem = Pattern;

/**
 * Timeline arrangement
 */
export interface Timeline {
  canvas: Array<[Fraction, number, TimelineItem]>; // [time, channel, item]
}

/**
 * Playback configuration
 */
export interface PlaybackConfig {
  tempo: number; // microseconds per quarter note
  ppq: number; // pulses per quarter note
  startTime: Fraction;
  endTime: Fraction | null;
  defaultPrograms: Record<number, number>; // channel -> program
}

/**
 * MIDI event for playback
 */
export interface MIDIEvent {
  timeMs: number;
  message: number[];
}
