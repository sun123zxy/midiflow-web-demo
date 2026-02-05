import Fraction from 'fraction.js';
import type { Timeline, PlaybackConfig, Pattern } from '@/types';
import type { MIDIManager } from '@/engine/midi';

/**
 * Playback state
 */
export const PlaybackState = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  PAUSED: 'paused',
} as const;

export type PlaybackState = typeof PlaybackState[keyof typeof PlaybackState];

/**
 * MIDI event for scheduling
 */
interface ScheduledEvent {
  timeMs: number;
  type: 'noteOn' | 'noteOff' | 'programChange';
  channel: number;
  data: number[];
}

/**
 * MIDIPlayback - High-precision MIDI playback engine
 */
export class MIDIPlayback {
  private midiManager: MIDIManager;
  private events: ScheduledEvent[] = [];
  private eventIndex: number = 0;
  private schedulerId: number | null = null;
  private startTimeMs: number = 0;
  private state: PlaybackState = PlaybackState.STOPPED;
  private currentTimeMs: number = 0;
  private pausedAtMs: number = 0;

  constructor(midiManager: MIDIManager) {
    this.midiManager = midiManager;
  }

  /**
   * Render timeline to MIDI events
   */
  private renderEvents(timeline: Timeline, config: PlaybackConfig): ScheduledEvent[] {
    const events: ScheduledEvent[] = [];
    const startTime = config.startTime;
    const endTime = config.endTime ?? new Fraction(Number.MAX_SAFE_INTEGER);

    // Send default program changes at time 0
    for (const [channel, program] of Object.entries(config.defaultPrograms)) {
      events.push({
        timeMs: 0,
        type: 'programChange',
        channel: parseInt(channel),
        data: [program],
      });
    }

    // Process timeline canvas
    for (const [time, channel, item] of timeline.canvas) {
      // Skip items outside playback range
      if (time.compare(endTime) >= 0) continue;

      // All items are patterns (program changes are per-channel settings, not timeline items)
      const pattern = item as Pattern;
      for (const [noteStartTime, note] of pattern.notes) {
        const absoluteTime = time.add(noteStartTime);

        // Skip notes outside playback range
        if (absoluteTime.compare(startTime) < 0) continue;
        if (absoluteTime.compare(endTime) >= 0) continue;

        const relativeTime = absoluteTime.sub(startTime);
        const startMs = this.fractionToMs(relativeTime, config);
        const endMs = this.fractionToMs(
          relativeTime.add(note.duration),
          config
        );

        // Note On
        events.push({
          timeMs: startMs,
          type: 'noteOn',
          channel,
          data: [note.note, note.velocity],
        });

        // Note Off
        events.push({
          timeMs: endMs,
          type: 'noteOff',
          channel,
          data: [note.note, note.velocity],
        });
      }
    }

    // Sort by time, with note-off events before note-on at the same timestamp
    events.sort((a, b) => {
      const timeDiff = a.timeMs - b.timeMs;
      if (timeDiff !== 0) return timeDiff;
      
      // At same timestamp: noteOff < noteOn (programChange always at time 0)
      const typeOrder = { noteOff: 0, programChange: 1, noteOn: 2 };
      return typeOrder[a.type] - typeOrder[b.type];
    });

    return events;
  }

  /**
   * Convert Fraction time to milliseconds
   */
  private fractionToMs(time: Fraction, config: PlaybackConfig): number {
    // time is in whole notes, convert to quarter notes first
    // 1 whole note = 4 quarter notes
    const quarterNotes = time.mul(4);
    // tempo is microseconds per quarter note
    const microseconds = quarterNotes.mul(config.tempo).valueOf();
    return microseconds / 1000;
  }

  /**
   * Scheduler function - runs at ~60fps via requestAnimationFrame
   */
  private schedule = (): void => {
    if (this.state !== PlaybackState.PLAYING) return;

    const currentMs = performance.now() - this.startTimeMs;
    this.currentTimeMs = currentMs;

    // Send all events up to current time (with small lookahead)
    const lookaheadMs = 50; // 50ms lookahead for timing accuracy
    const targetTime = currentMs + lookaheadMs;

    while (this.eventIndex < this.events.length) {
      const event = this.events[this.eventIndex];

      if (event.timeMs > targetTime) break;

      // Calculate precise timestamp
      const timestamp = performance.now() + (event.timeMs - currentMs);

      // Send MIDI message
      switch (event.type) {
        case 'noteOn':
          this.midiManager.sendNoteOn(
            event.channel,
            event.data[0],
            event.data[1],
            timestamp
          );
          break;
        case 'noteOff':
          this.midiManager.sendNoteOff(
            event.channel,
            event.data[0],
            event.data[1],
            timestamp
          );
          break;
        case 'programChange':
          this.midiManager.sendProgramChange(event.channel, event.data[0], timestamp);
          break;
      }

      this.eventIndex++;
    }

    // Continue scheduling - keep playing even after all events are done
    this.schedulerId = requestAnimationFrame(this.schedule);
  };

  /**
   * Start playback
   */
  play(timeline: Timeline, config: PlaybackConfig): void {
    if (this.state === PlaybackState.PLAYING) return;

    if (this.state === PlaybackState.PAUSED) {
      // Resume from pause
      this.startTimeMs = performance.now() - this.pausedAtMs;
      this.state = PlaybackState.PLAYING;
      this.schedulerId = requestAnimationFrame(this.schedule);
    } else {
      // Start from beginning
      this.events = this.renderEvents(timeline, config);
      this.eventIndex = 0;
      this.startTimeMs = performance.now();
      this.currentTimeMs = 0;
      this.state = PlaybackState.PLAYING;
      this.schedulerId = requestAnimationFrame(this.schedule);
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state !== PlaybackState.PLAYING) return;

    this.state = PlaybackState.PAUSED;
    this.pausedAtMs = this.currentTimeMs;

    if (this.schedulerId !== null) {
      cancelAnimationFrame(this.schedulerId);
      this.schedulerId = null;
    }

    // Send all notes off
    this.midiManager.panic();
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.state = PlaybackState.STOPPED;
    this.currentTimeMs = 0;
    this.pausedAtMs = 0;
    this.eventIndex = 0;

    if (this.schedulerId !== null) {
      cancelAnimationFrame(this.schedulerId);
      this.schedulerId = null;
    }

    // Send all notes off
    this.midiManager.panic();
  }

  /**
   * Seek to a specific time (in milliseconds)
   */
  seek(timeMs: number): void {
    const wasPlaying = this.state === PlaybackState.PLAYING;

    if (wasPlaying) {
      this.pause();
    }

    // Find event index for this time
    this.eventIndex = 0;
    while (
      this.eventIndex < this.events.length &&
      this.events[this.eventIndex].timeMs < timeMs
    ) {
      this.eventIndex++;
    }

    this.currentTimeMs = timeMs;
    this.pausedAtMs = timeMs;

    if (wasPlaying) {
      this.startTimeMs = performance.now() - timeMs;
      this.state = PlaybackState.PLAYING;
      this.schedulerId = requestAnimationFrame(this.schedule);
    }
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current playback time in milliseconds
   */
  getCurrentTime(): number {
    if (this.state === PlaybackState.PLAYING) {
      return performance.now() - this.startTimeMs;
    }
    return this.currentTimeMs;
  }

  /**
   * Get total duration of timeline in milliseconds
   */
  getDuration(timeline: Timeline, config: PlaybackConfig): number {
    if (this.events.length === 0) {
      this.events = this.renderEvents(timeline, config);
    }

    if (this.events.length === 0) return 0;

    return this.events[this.events.length - 1].timeMs;
  }

  /**
   * Convert milliseconds to Fraction time (in whole notes)
   */
  msToFraction(timeMs: number, config: PlaybackConfig): Fraction {
    // tempo is microseconds per quarter note
    const microseconds = timeMs * 1000;
    // Convert to quarter notes
    const quarterNotes = microseconds / config.tempo;
    // Convert to whole notes (1 whole note = 4 quarter notes)
    return new Fraction(quarterNotes / 4);
  }
}
