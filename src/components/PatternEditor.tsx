/**
 * Pattern Editor - Piano roll for editing pattern content
 */
import { useState, useEffect } from 'react';
import Fraction from 'fraction.js';
import { usePatternFlowStore } from '@/store/patternFlowStore';
import { PianoRoll } from './pianoroll/PianoRoll';
import { calculatePatternBounds } from '@/engine/pattern';
import type { PatternNodeData } from '@/types/patternflow';
import type { Note } from '@/types/midi';

export function PatternEditor() {
  const { selectedNodeId, nodes, updateNodeData } = usePatternFlowStore();
  
  // Zoom state (matching Timeline architecture)
  const [pixelsPerBeat, setPixelsPerBeat] = useState(100);
  const [localZoom, setLocalZoom] = useState<number | null>(null);
  const [activeTool, setActiveTool] = useState<'draw' | 'select'>('draw');
  const [snapDenominator, setSnapDenominator] = useState(16);
  const [selectedNoteIndices, setSelectedNoteIndices] = useState<number[]>([]);
  const [clipboardNotes, setClipboardNotes] = useState<Array<[Fraction, Note]>>([]);
  const [defaultDuration, setDefaultDuration] = useState(new Fraction(1, 4)); // Quarter note
  const [defaultVelocity, setDefaultVelocity] = useState(80);

  // Get the selected pattern node
  const node = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
  const patternData = node?.data as PatternNodeData | undefined;

  if (!selectedNodeId || !node || node.data.type !== 'pattern-source') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-gray-400">
        <div className="text-center">
          <p className="text-xl mb-2">No pattern selected</p>
          <p className="text-sm">Select a pattern source node to edit</p>
        </div>
      </div>
    );
  }

  const pattern = patternData?.pattern.notes || [];
  const selectedVelocity = selectedNoteIndices.length > 0
    ? (patternData?.pattern.notes[selectedNoteIndices[0]]?.[1].velocity ?? 80)
    : 80;

  // Update default duration and velocity when selection changes
  useEffect(() => {
    if (selectedNoteIndices.length > 0 && patternData) {
      const lastSelectedNote = patternData.pattern.notes[selectedNoteIndices[selectedNoteIndices.length - 1]];
      if (lastSelectedNote) {
        const [, note] = lastSelectedNote;
        setDefaultDuration(note.duration);
        setDefaultVelocity(note.velocity);
      }
    }
  }, [selectedNoteIndices, patternData]);

  // Snap time to grid (matching Timeline - time is in whole notes/measures)
  // snap=1 → 1 whole note, snap=4 → 1/4 whole note, snap=16 → 1/16 whole note
  const snapTime = (time: Fraction): Fraction => {
    if (snapDenominator === 0) return time;
    const gridSize = new Fraction(1, snapDenominator);
    const snapped = time.div(gridSize).round().mul(gridSize);
    return snapped;
  };

  // Add note
  const handleAddNote = (startTime: Fraction, note: Note) => {
    if (!selectedNodeId || !patternData) return;
    const newNotes = [...patternData.pattern.notes, [startTime, note] as [Fraction, Note]];
    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  // Update note
  const handleUpdateNote = (index: number, startTime: Fraction, note: Note) => {
    if (!selectedNodeId || !patternData) return;
    const newNotes = [...patternData.pattern.notes];
    newNotes[index] = [startTime, note];
    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  // Batch update multiple notes (for multi-drag)
  const handleUpdateNotes = (updates: Array<{ index: number; startTime: Fraction; note: Note }>) => {
    if (!selectedNodeId || !patternData) return;
    const newNotes = [...patternData.pattern.notes];
    updates.forEach(({ index, startTime, note }) => {
      newNotes[index] = [startTime, note];
    });
    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  // Delete note
  const handleDeleteNote = (index: number) => {
    if (!selectedNodeId || !patternData) return;
    const newNotes = patternData.pattern.notes.filter((_, i) => i !== index);
    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  // Batch delete multiple notes
  const handleDeleteNotes = (indices: number[]) => {
    if (!selectedNodeId || !patternData) return;
    const indexSet = new Set(indices);
    const newNotes = patternData.pattern.notes.filter((_, i) => !indexSet.has(i));
    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  const handlePatternDurationChange = (duration: Fraction) => {
    if (!selectedNodeId || !patternData) return;
    const newPattern = {
      ...patternData.pattern,
      duration,
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
  };

  const copySelection = () => {
    if (!patternData || selectedNoteIndices.length === 0) return;
    const copied = selectedNoteIndices
      .map((index) => patternData.pattern.notes[index])
      .filter(Boolean)
      .map(([startTime, note]) => [
        new Fraction(startTime),
        {
          ...note,
          duration: new Fraction(note.duration),
        },
      ] as [Fraction, Note]);
    setClipboardNotes(copied);
  };

  const pasteSelection = (offsetTime: Fraction = new Fraction(1)) => {
    if (!selectedNodeId || !patternData || clipboardNotes.length === 0) return;
    let minTime = new Fraction(Number.MAX_SAFE_INTEGER);
    clipboardNotes.forEach(([time]) => {
      if (time.compare(minTime) < 0) minTime = time;
    });

    const newNotes = [...patternData.pattern.notes];
    const newSelected: number[] = [];
    clipboardNotes.forEach(([time, note]) => {
      const newTime = time.sub(minTime).add(offsetTime);
      newNotes.push([
        new Fraction(newTime),
        {
          ...note,
          duration: new Fraction(note.duration),
        },
      ]);
      newSelected.push(newNotes.length - 1);
    });

    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
    setSelectedNoteIndices(newSelected);
  };

  const duplicateSelection = (offsetTime: Fraction = new Fraction(1)) => {
    if (!selectedNodeId || !patternData || selectedNoteIndices.length === 0) return;
    const sourceNotes = selectedNoteIndices
      .map((index) => patternData.pattern.notes[index])
      .filter(Boolean) as Array<[Fraction, Note]>;

    let minTime = new Fraction(Number.MAX_SAFE_INTEGER);
    sourceNotes.forEach(([time]) => {
      if (time.compare(minTime) < 0) minTime = time;
    });

    const newNotes = [...patternData.pattern.notes];
    const newSelected: number[] = [];
    sourceNotes.forEach(([time, note]) => {
      const newTime = time.sub(minTime).add(offsetTime);
      newNotes.push([
        new Fraction(newTime),
        {
          ...note,
          duration: new Fraction(note.duration),
        },
      ]);
      newSelected.push(newNotes.length - 1);
    });

    const newPattern = {
      ...patternData.pattern,
      notes: newNotes,
      bounds: calculatePatternBounds(newNotes),
    };
    updateNodeData(selectedNodeId, { pattern: newPattern });
    setSelectedNoteIndices(newSelected);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNoteIndices.length > 0) {
          handleDeleteNotes(selectedNoteIndices);
          setSelectedNoteIndices([]);
        }
      }

      // Copy (Ctrl/Cmd + C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedNoteIndices.length > 0) {
          e.preventDefault();
          copySelection();
        }
      }

      // Paste (Ctrl/Cmd + V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteSelection();
      }

      // Duplicate (Ctrl/Cmd + D)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        if (selectedNoteIndices.length > 0) {
          e.preventDefault();
          duplicateSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNoteIndices, selectedNodeId, patternData, clipboardNotes]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="text-gray-400">Editing:</span>
            <span className="ml-2 text-white font-semibold">{patternData?.name || node.id}</span>
          </div>
          
          {/* Tools */}
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTool('select')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTool === 'select'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Region Select"
            >
              ⬚ Select
            </button>
            <button
              onClick={() => setActiveTool('draw')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTool === 'draw'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              ✏️ Draw
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">
            {pattern.length} notes {selectedNoteIndices.length > 0 && `(${selectedNoteIndices.length} selected)`}
          </span>

          {/* Velocity Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Velocity:</span>
            <input
              type="range"
              min={1}
              max={127}
              value={selectedVelocity}
              disabled={selectedNoteIndices.length === 0}
              onChange={(e) => {
                if (!patternData || selectedNoteIndices.length === 0) return;
                const velocity = Math.max(1, Math.min(127, Number(e.target.value)));
                const updates = selectedNoteIndices.map((index) => {
                  const [startTime, note] = patternData.pattern.notes[index];
                  return {
                    index,
                    startTime,
                    note: {
                      ...note,
                      velocity,
                    },
                  };
                });
                handleUpdateNotes(updates);
              }}
              className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 disabled:cursor-not-allowed"
            />
            <span className="text-right text-xs text-gray-400">{selectedVelocity}</span>
          </div>
          
          {/* Zoom Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Zoom:</span>
            <input
              type="range"
              min="20"
              max="200"
              value={localZoom ?? pixelsPerBeat}
              onChange={(e) => setLocalZoom(Number(e.target.value))}
              onMouseUp={() => {
                if (localZoom !== null) {
                  setPixelsPerBeat(localZoom);
                  setLocalZoom(null);
                }
              }}
              onTouchEnd={() => {
                if (localZoom !== null) {
                  setPixelsPerBeat(localZoom);
                  setLocalZoom(null);
                }
              }}
              className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <span className="text-right text-xs">{Math.round(localZoom ?? pixelsPerBeat)}px</span>
          </div>

          {/* Snap Control */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Snap:</span>
            <select
              value={snapDenominator}
              onChange={(e) => setSnapDenominator(Number(e.target.value))}
              className="px-2 py-1 text-xs bg-gray-700 text-gray-200 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value={0}>None</option>
              <option value={1}>1</option>
              <option value={2}>1/2</option>
              <option value={4}>1/4</option>
              <option value={8}>1/8</option>
              <option value={16}>1/16</option>
              <option value={32}>1/32</option>
            </select>
          </div>
        </div>
      </div>

      {/* Piano Roll */}
      <div className="flex-1 overflow-hidden">
        <PianoRoll
          pattern={pattern}
          pixelsPerBeat={pixelsPerBeat}
          activeTool={activeTool}
          snapTime={snapTime}
          patternDuration={patternData?.pattern.duration ?? null}
          onPatternDurationChange={handlePatternDurationChange}
          selectedNoteIndices={selectedNoteIndices}
          onSelectNotes={setSelectedNoteIndices}
          onClearSelection={() => setSelectedNoteIndices([])}
          onNoteAdd={handleAddNote}
          onNoteEdit={handleUpdateNote}
          onNotesEdit={handleUpdateNotes}
          onNoteDelete={handleDeleteNote}
          defaultDuration={defaultDuration}
          defaultVelocity={defaultVelocity}
        />
      </div>
    </div>
  );
}
