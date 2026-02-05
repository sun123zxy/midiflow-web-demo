/**
 * MIDI file import/export utilities using midifile-ts
 */

import { read, write } from 'midifile-ts';
import type { AnyEvent, NoteOnEvent, NoteOffEvent, ProgramChangeEvent, SetTempoEvent, EndOfTrackEvent } from 'midifile-ts';
import type { Pattern, Timeline, PlaybackConfig } from '@/types';
import Fraction from 'fraction.js';
import { createPattern, addNote, createNote } from '@/engine/pattern';

/**
 * Import MIDI file and convert to patterns (one per track)
 */
export async function importMIDI(file: File): Promise<{
  patterns: Pattern[];
  ppq: number;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const midi = read(arrayBuffer);

  const ppq = midi.header.ticksPerBeat;

  // Convert each track to a pattern
  const patterns = midi.tracks.map((track) => {
    let pattern = createPattern();
    
    // Track note on/off events to compute durations
    const noteOnEvents = new Map<number, { tick: number; velocity: number }>();
    let currentTick = 0;

    for (const event of track) {
      currentTick += event.deltaTime;
      
      if (event.type === 'channel') {
        if (event.subtype === 'noteOn' && event.velocity > 0) {
          // Store note on event
          noteOnEvents.set(event.noteNumber, { tick: currentTick, velocity: event.velocity });
        } else if (event.subtype === 'noteOff' || (event.subtype === 'noteOn' && event.velocity === 0)) {
          // Find corresponding note on
          const noteOn = noteOnEvents.get(event.noteNumber);
          if (noteOn) {
            // Calculate duration in ticks
            const durationTicks = currentTick - noteOn.tick;
            
            // Convert ticks to whole notes
            // ticks / ppq = quarter notes, / 4 = whole notes
            const timeInWholeNotes = new Fraction(noteOn.tick, ppq * 4);
            const durationInWholeNotes = new Fraction(durationTicks, ppq * 4);

            const noteObj = createNote(
              event.noteNumber,
              noteOn.velocity,
              durationInWholeNotes
            );
            pattern = addNote(pattern, timeInWholeNotes, noteObj);
            
            noteOnEvents.delete(event.noteNumber);
          }
        }
      }
    }

    // Set pattern duration based on the actual notes
    if (pattern.notes.length > 0) {
      let maxEndTime = new Fraction(0);
      for (const [startTime, note] of pattern.notes) {
        const endTime = startTime.add(note.duration);
        if (endTime.compare(maxEndTime) > 0) {
          maxEndTime = endTime;
        }
      }
      pattern = { ...pattern, duration: maxEndTime };
    }

    return pattern;
  });

  return { patterns, ppq };
}

/**
 * Export Timeline to binary MIDI file
 */
export function exportMIDI(
  timeline: Timeline,
  config: PlaybackConfig
): Blob {
  const { tempo } = config;
  const ppq = 480; // Standard MIDI ticks per quarter note

  // Single track with tempo event
  const track: AnyEvent[] = [];
  
  const tempoEvent: SetTempoEvent = {
    deltaTime: 0,
    type: 'meta',
    subtype: 'setTempo',
    microsecondsPerBeat: tempo
  };
  track.push(tempoEvent);

  // Add program change events for all configured channels
  for (let ch = 0; ch < 16; ch++) {
    const program = config.defaultPrograms[ch];
    if (program !== undefined) {
      const programEvent: ProgramChangeEvent = {
        deltaTime: 0,
        type: 'channel',
        subtype: 'programChange',
        channel: ch,
        value: program
      };
      track.push(programEvent);
    }
  }

  // Collect all notes with their absolute tick times and channels
  const allEvents: Array<{ tick: number; event: NoteOnEvent | NoteOffEvent }> = [];

  for (const [startTime, channel, item] of timeline.canvas) {
    if ('notes' in item) {
      const pattern = item;

      for (const [noteTime, note] of pattern.notes) {
        const absoluteTime = startTime.add(noteTime);
        
        // Skip notes with negative start times
        if (absoluteTime.compare(0) < 0) {
          continue;
        }
        
        // Skip notes beyond pattern duration if specified
        if (pattern.duration && noteTime.compare(pattern.duration) >= 0) {
          continue;
        }
        
        // Convert whole notes to ticks
        const tick = Math.round(absoluteTime.valueOf() * 4 * ppq);
        const durationTicks = Math.round(note.duration.valueOf() * 4 * ppq);

        // Note on
        allEvents.push({
          tick,
          event: {
            deltaTime: 0, // Will be calculated later
            type: 'channel',
            subtype: 'noteOn',
            channel,
            noteNumber: note.note,
            velocity: note.velocity
          }
        });
        
        // Note off
        allEvents.push({
          tick: tick + durationTicks,
          event: {
            deltaTime: 0,
            type: 'channel',
            subtype: 'noteOff',
            channel,
            noteNumber: note.note,
            velocity: 0
          }
        });
      }
    }
  }

  // Sort all events by tick
  allEvents.sort((a, b) => a.tick - b.tick);
  
  // Calculate delta times and add to track
  let lastTick = 0;
  for (const { tick, event } of allEvents) {
    event.deltaTime = tick - lastTick;
    lastTick = tick;
    track.push(event);
  }

  // Add End of Track event (required by MIDI spec)
  const endOfTrackEvent: EndOfTrackEvent = {
    deltaTime: 0,
    type: 'meta',
    subtype: 'endOfTrack'
  };
  track.push(endOfTrackEvent);

  // Write MIDI file with single track
  const midiData = write([track], ppq);
  // Convert to regular Uint8Array for Blob
  const uint8Array = new Uint8Array(midiData);
  const blob = new Blob([uint8Array], { type: 'audio/midi' });
  
  return blob;
}
