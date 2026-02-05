import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface SettingsState {
  tempo: number; // BPM
  beatsPerMeasure: number;
  beatUnit: number; // 4 for quarter note, 8 for eighth, etc.
  ppq: number; // Pulses per quarter note
  selectedOutputId: string | null;
  timelineLeftBorder: number; // Canvas left border in measures (can be negative)
  timelineRightBorder: number; // Canvas right border in measures
  patternEditorLeftBorder: number; // Pattern editor canvas left border in measures (can be negative)
  patternEditorRightBorder: number; // Pattern editor canvas right border in measures
  
  setTempo: (tempo: number) => void;
  setBeatsPerMeasure: (beats: number) => void;
  setBeatUnit: (unit: number) => void;
  setPPQ: (ppq: number) => void;
  setSelectedOutputId: (id: string | null) => void;
  setTimelineLeftBorder: (measures: number) => void;
  setTimelineRightBorder: (measures: number) => void;
  setPatternEditorLeftBorder: (measures: number) => void;
  setPatternEditorRightBorder: (measures: number) => void;
  
  // Helper to get tempo in microseconds per quarter note
  getTempoMicroseconds: () => number;
}

const initialState = {
  tempo: 120, // 120 BPM
  beatsPerMeasure: 4,
  beatUnit: 4, // Quarter note
  ppq: 480,
  selectedOutputId: null,
  timelineLeftBorder: -1, // Start at measure -1 for prep area
  timelineRightBorder: 50, // End at measure 50
  patternEditorLeftBorder: -1, // Start at measure -1 for prep area
  patternEditorRightBorder: 8, // End at measure 8 (smaller default for performance)
};

export const useSettingsStore = create<SettingsState>()(
  immer((set, get) => ({
    ...initialState,
    
    setTempo: (tempo) => {
      set((state) => {
        state.tempo = Math.max(20, Math.min(300, tempo));
      });
    },
    
    setBeatsPerMeasure: (beats) => {
      set((state) => {
        state.beatsPerMeasure = Math.max(1, Math.min(16, beats));
      });
    },
    
    setBeatUnit: (unit) => {
      set((state) => {
        state.beatUnit = unit;
      });
    },
    
    setPPQ: (ppq) => {
      set((state) => {
        state.ppq = ppq;
      });
    },
    
    setSelectedOutputId: (id) => {
      set((state) => {
        state.selectedOutputId = id;
      });
    },
    
    setTimelineLeftBorder: (measures) => {
      set((state) => {
        state.timelineLeftBorder = Math.max(-100, Math.min(state.timelineRightBorder - 1, measures));
      });
    },
    
    setTimelineRightBorder: (measures) => {
      set((state) => {
        state.timelineRightBorder = Math.max(state.timelineLeftBorder + 1, Math.min(500, measures));
      });
    },
    
    setPatternEditorLeftBorder: (measures) => {
      set((state) => {
        state.patternEditorLeftBorder = Math.max(-100, Math.min(state.patternEditorRightBorder - 1, measures));
      });
    },
    
    setPatternEditorRightBorder: (measures) => {
      set((state) => {
        state.patternEditorRightBorder = Math.max(state.patternEditorLeftBorder + 1, Math.min(500, measures));
      });
    },
    
    getTempoMicroseconds: () => {
      const { tempo } = get();
      // Tempo is quarter notes per minute
      return 60000000 / tempo; // Convert to microseconds per quarter note
    },
  }))
);
