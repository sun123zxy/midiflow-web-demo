import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import Fraction from 'fraction.js';

export interface TimelineItem {
  id: string;
  time: Fraction;      // Start time in whole notes
  channel: number;     // 0-15
  nodeId: string;      // Reference to pattern node in PatternFlow (only thing we need!)
}

interface TimelineState {
  items: TimelineItem[];
  
  // Channel programs (0-127 for each of 16 channels)
  channelPrograms: number[];
  channelMuted: boolean[];     // Mute state for each channel
  channelSolo: boolean[];      // Solo state for each channel
  
  // View settings
  pixelsPerBeat: number;    // Horizontal zoom
  beatsPerMeasure: number;  // Time signature numerator
  scrollX: number;          // Horizontal scroll position
  playbackStartTime: Fraction;  // Where playback starts
  
  // Snap settings
  snapEnabled: boolean;     // Whether snap-to-grid is enabled
  snapDenominator: number;  // Snap grid denominator (4 = quarter notes, 8 = eighth notes, etc.)
  
  // Selection
  selectedItemIds: string[];
  
  // Clipboard
  clipboardItems: TimelineItem[];
  
  // Actions
  addItem: (item: TimelineItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<TimelineItem>) => void;
  
  setChannelProgram: (channel: number, program: number) => void;
  toggleChannelMute: (channel: number) => void;
  toggleChannelSolo: (channel: number) => void;
  
  setPixelsPerBeat: (pixels: number) => void;
  setScrollX: (scrollX: number) => void;
  setPlaybackStartTime: (time: Fraction) => void;
  
  setSnapEnabled: (enabled: boolean) => void;
  setSnapDenominator: (denominator: number) => void;
  
  selectItems: (ids: string[]) => void;
  clearSelection: () => void;
  
  copySelection: () => void;
  pasteSelection: (offsetTime?: Fraction, offsetChannel?: number) => void;
  duplicateSelection: (offsetTime?: Fraction, offsetChannel?: number) => void;
  
  reset: () => void;
}

const initialState = {
  items: [],
  channelPrograms: Array(16).fill(0), // All channels default to program 0 (Acoustic Grand Piano)
  channelMuted: Array(16).fill(false),
  channelSolo: Array(16).fill(false),
  pixelsPerBeat: 40,
  beatsPerMeasure: 4,
  scrollX: 0,
  playbackStartTime: new Fraction(0),
  selectedItemIds: [],
  clipboardItems: [],
  snapEnabled: true,
  snapDenominator: 4,
};

export const useTimelineStore = create<TimelineState>()(
  immer((set) => ({
    ...initialState,
    
    addItem: (item) => {
      set((state) => {
        state.items.push(item);
      });
    },
    
    removeItem: (id) => {
      set((state) => {
        state.items = state.items.filter((item) => item.id !== id);
        state.selectedItemIds = state.selectedItemIds.filter((itemId) => itemId !== id);
      });
    },
    
    updateItem: (id, updates) => {
      set((state) => {
        const item = state.items.find((item) => item.id === id);
        if (item) {
          Object.assign(item, updates);
        }
      });
    },
    
    setChannelProgram: (channel, program) => {
      set((state) => {
        if (channel >= 0 && channel < 16 && program >= 0 && program <= 127) {
          state.channelPrograms[channel] = program;
        }
      });
    },
    
    toggleChannelMute: (channel) => {
      set((state) => {
        if (channel >= 0 && channel < 16) {
          state.channelMuted[channel] = !state.channelMuted[channel];
          // If muting, automatically unsolo
          if (state.channelMuted[channel]) {
            state.channelSolo[channel] = false;
          }
        }
      });
    },
    
    toggleChannelSolo: (channel) => {
      set((state) => {
        if (channel >= 0 && channel < 16) {
          state.channelSolo[channel] = !state.channelSolo[channel];
          // If soloing, automatically unmute
          if (state.channelSolo[channel]) {
            state.channelMuted[channel] = false;
          }
        }
      });
    },
    
    setPixelsPerBeat: (pixels) => {
      set({ pixelsPerBeat: pixels });
    },
    
    setScrollX: (scrollX) => {
      set({ scrollX: Math.max(0, scrollX) });
    },
    
    setPlaybackStartTime: (time) => {
      set({ playbackStartTime: time });
    },
    
    setSnapEnabled: (enabled) => {
      set({ snapEnabled: enabled });
    },
    
    setSnapDenominator: (denominator) => {
      set({ snapDenominator: denominator });
    },
    
    selectItems: (ids) => {
      set({ selectedItemIds: ids });
    },
    
    clearSelection: () => {
      set({ selectedItemIds: [] });
    },
    
    copySelection: () => {
      set((state) => {
        // Copy selected items
        state.clipboardItems = state.selectedItemIds
          .map(id => state.items.find(item => item.id === id))
          .filter((item): item is TimelineItem => item !== undefined)
          .map(item => ({
            ...item,
            time: new Fraction(item.time), // Deep copy Fraction
          }));
      });
    },
    
    pasteSelection: (offsetTime = new Fraction(1), offsetChannel = 0) => {
      set((state) => {
        // Find minimum time to calculate offset
        let minTime = new Fraction(Number.MAX_SAFE_INTEGER);
        state.clipboardItems.forEach(item => {
          if (item.time.compare(minTime) < 0) minTime = item.time;
        });
        
        const newItemIds: string[] = [];
        
        // Paste items
        state.clipboardItems.forEach(item => {
          const newId = `item-${Date.now()}-${Math.random()}`;
          const timeOffset = item.time.sub(minTime).add(offsetTime);
          state.items.push({
            ...item,
            id: newId,
            time: timeOffset,
            channel: Math.max(0, Math.min(15, item.channel + offsetChannel)),
          });
          newItemIds.push(newId);
        });
        
        // Select newly pasted items
        state.selectedItemIds = newItemIds;
      });
    },
    
    duplicateSelection: (offsetTime = new Fraction(1), offsetChannel = 0) => {
      set((state) => {
        const newItemIds: string[] = [];
        
        // Duplicate items
        state.selectedItemIds.forEach(id => {
          const item = state.items.find(item => item.id === id);
          if (item) {
            const newId = `item-${Date.now()}-${Math.random()}`;
            state.items.push({
              ...item,
              id: newId,
              time: item.time.add(offsetTime),
              channel: Math.max(0, Math.min(15, item.channel + offsetChannel)),
            });
            newItemIds.push(newId);
          }
        });
        
        // Select newly duplicated items
        state.selectedItemIds = newItemIds;
      });
    },
    
    reset: () => set(initialState),
  }))
);
