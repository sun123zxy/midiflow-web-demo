/**
 * Web MIDI API wrapper for MidiFlow
 */

export interface MIDIDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
}

export class MIDIManager {
  private access: MIDIAccess | null = null;
  private selectedOutput: MIDIOutput | null = null;
  private initialized: boolean = false;

  /**
   * Initialize Web MIDI API
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      this.access = await navigator.requestMIDIAccess();
      this.initialized = true;

      // Auto-select first available output
      const outputs = Array.from(this.access.outputs.values());
      if (outputs.length > 0) {
        this.selectedOutput = outputs[0];
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize Web MIDI API: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if Web MIDI API is supported
   */
  static isSupported(): boolean {
    return 'requestMIDIAccess' in navigator;
  }

  /**
   * Get list of available MIDI output devices
   */
  getOutputDevices(): MIDIDevice[] {
    if (!this.access) return [];

    return Array.from(this.access.outputs.values()).map((output) => ({
      id: output.id,
      name: output.name || 'Unknown Device',
      manufacturer: output.manufacturer || 'Unknown',
      state: output.state,
    }));
  }

  /**
   * Select a MIDI output device by ID
   */
  selectOutput(deviceId: string): boolean {
    if (!this.access) return false;

    const output = this.access.outputs.get(deviceId);
    if (output) {
      this.selectedOutput = output;
      return true;
    }
    return false;
  }

  /**
   * Get currently selected output device
   */
  getSelectedOutput(): MIDIDevice | null {
    if (!this.selectedOutput) return null;

    return {
      id: this.selectedOutput.id,
      name: this.selectedOutput.name || 'Unknown Device',
      manufacturer: this.selectedOutput.manufacturer || 'Unknown',
      state: this.selectedOutput.state,
    };
  }

  /**
   * Send a MIDI message
   */
  send(message: number[], timestamp?: number): void {
    if (!this.selectedOutput) {
      console.warn('No MIDI output device selected');
      return;
    }

    try {
      if (timestamp !== undefined) {
        this.selectedOutput.send(message, timestamp);
      } else {
        this.selectedOutput.send(message);
      }
    } catch (error) {
      console.error('Failed to send MIDI message:', error);
    }
  }

  /**
   * Send Note On message
   */
  sendNoteOn(channel: number, note: number, velocity: number, timestamp?: number): void {
    const status = 0x90 | (channel & 0x0f); // Note On + channel
    this.send([status, note & 0x7f, velocity & 0x7f], timestamp);
  }

  /**
   * Send Note Off message
   */
  sendNoteOff(channel: number, note: number, velocity: number, timestamp?: number): void {
    const status = 0x80 | (channel & 0x0f); // Note Off + channel
    this.send([status, note & 0x7f, velocity & 0x7f], timestamp);
  }

  /**
   * Send Program Change message
   */
  sendProgramChange(channel: number, program: number, timestamp?: number): void {
    const status = 0xc0 | (channel & 0x0f); // Program Change + channel
    this.send([status, program & 0x7f], timestamp);
  }

  /**
   * Send Control Change message
   */
  sendControlChange(
    channel: number,
    controller: number,
    value: number,
    timestamp?: number
  ): void {
    const status = 0xb0 | (channel & 0x0f); // Control Change + channel
    this.send([status, controller & 0x7f, value & 0x7f], timestamp);
  }

  /**
   * Send All Notes Off on a channel
   */
  allNotesOff(channel: number): void {
    // CC 123: All Notes Off
    this.sendControlChange(channel, 123, 0);
  }

  /**
   * Send All Notes Off on all channels (panic button)
   */
  panic(): void {
    for (let channel = 0; channel < 16; channel++) {
      this.allNotesOff(channel);
      
      // Also send note off for all possible notes
      for (let note = 0; note < 128; note++) {
        this.sendNoteOff(channel, note, 0);
      }
    }
  }

  /**
   * Listen for MIDI access state changes
   */
  onStateChange(callback: (event: Event) => void): void {
    if (this.access) {
      this.access.addEventListener('statechange', callback);
    }
  }

  /**
   * Remove state change listener
   */
  removeStateChangeListener(callback: (event: Event) => void): void {
    if (this.access) {
      this.access.removeEventListener('statechange', callback);
    }
  }

  /**
   * Close and cleanup
   */
  close(): void {
    if (this.selectedOutput) {
      this.selectedOutput.close();
      this.selectedOutput = null;
    }
    this.access = null;
    this.initialized = false;
  }
}

// Singleton instance
export const midiManager = new MIDIManager();
