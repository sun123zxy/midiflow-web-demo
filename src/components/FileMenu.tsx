/**
 * File Import/Export Component
 */

import { useState, useRef } from 'react';
import Fraction from 'fraction.js';
import { importMIDI, exportMIDI } from '@/utils/midiIO';
import { importProject, downloadProject, type ExportProjectParams } from '@/utils/projectIO';

import { usePatternFlowStore } from '@/store/patternFlowStore';
import { useTimelineStore } from '@/store/timelineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { renderTimelineToMIDI } from '@/engine/timelineRenderer';
import type { Pattern, Timeline } from '@/types';

interface FileMenuProps {
  onImportMIDI: (patterns: Pattern[]) => void;
  activeView?: 'patternflow' | 'settings' | 'pattern-editor';
  onViewChange?: (view: 'patternflow' | 'settings' | 'pattern-editor') => void;
}

export function FileMenu({ onImportMIDI, onViewChange }: FileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  
  const { getTempoMicroseconds, ppq, tempo, beatsPerMeasure, beatUnit, timelineLeftBorder, timelineRightBorder, patternEditorLeftBorder, patternEditorRightBorder, setTempo, setBeatsPerMeasure, setBeatUnit, setPPQ, setTimelineLeftBorder, setTimelineRightBorder, setPatternEditorLeftBorder, setPatternEditorRightBorder } = useSettingsStore();
  const { nodes, edges, setNodes, setEdges, reset: resetPatternFlow } = usePatternFlowStore();
  const { items: timelineItems, channelPrograms, channelMuted, channelSolo, pixelsPerBeat, beatsPerMeasure: timelineBeatsPerMeasure, playbackStartTime, snapEnabled, snapDenominator, reset: resetTimeline } = useTimelineStore();

  const handleImportMIDI = async (file: File) => {
    try {
      const { patterns } = await importMIDI(file);
      onImportMIDI(patterns);
      if (onViewChange) {
        onViewChange('patternflow');
      }
      alert(`Imported ${patterns.length} track${patterns.length !== 1 ? 's' : ''} as pattern node${patterns.length !== 1 ? 's' : ''}!\n\nCheck PatternFlow view to see them.`);
    } catch (error) {
      alert(`Failed to import MIDI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportTimeline = () => {
    try {
      if (timelineItems.length === 0) {
        alert('Timeline is empty!\n\nAdd some patterns to the timeline first.');
        return;
      }

      const { nodes, edges } = usePatternFlowStore.getState();
      const rendered = renderTimelineToMIDI(timelineItems, { nodes, edges }, channelPrograms, channelMuted, channelSolo, getTempoMicroseconds(), ppq);
      const timeline = rendered.timeline;
      const config = rendered.config;
      const filename = 'timeline-export.mid';
      
      const blob = exportMIDI(timeline, config);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      alert('Timeline exported successfully!');
    } catch (error) {
      console.error('[FileMenu] Timeline export failed:', error);
      alert(`Failed to export timeline: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details.`);
    }
  };

  const handleExportPattern = () => {
    try {
      const selectedNode = nodes.find(n => n.selected);
      
      if (!selectedNode) {
        alert('No node selected!\n\nPlease select a node to export.\nClick a node to select it.');
        return;
      }
      
      const pattern = graphEvaluator.evaluate({ nodes, edges }, selectedNode.id);
      
      if (!pattern || pattern.notes.length === 0) {
        alert('Selected node could not produce an output pattern');
        return;
      }

      const timeline: Timeline = {
        canvas: [[new Fraction(0), 0, pattern]] as [Fraction, number, Pattern][],
      };

      const config = {
        tempo: getTempoMicroseconds(),
        ppq,
        startTime: new Fraction(0),
        endTime: null,
        defaultPrograms: { 0: 0 },
      };
      
      const filename = 'pattern-export.mid';
      const blob = exportMIDI(timeline, config);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      alert('Pattern exported successfully!');
    } catch (error) {
      console.error('[FileMenu] Pattern export failed:', error);
      alert(`Failed to export pattern: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details.`);
    }
  };

  const handleSaveProject = () => {
    try {
      const params: ExportProjectParams = {
        nodes,
        edges,
        timelineItems,
        channelPrograms,
        channelMuted,
        channelSolo,
        pixelsPerBeat,
        beatsPerMeasure: timelineBeatsPerMeasure,
        playbackStartTime,
        snapEnabled,
        snapDenominator,
        settings: {
          tempo,
          beatsPerMeasure,
          beatUnit,
          ppq,
          timelineLeftBorder,
          timelineRightBorder,
          patternEditorLeftBorder,
          patternEditorRightBorder,
        },
      };
      
      downloadProject(params, 'project.mdf');
      setIsOpen(false);
      alert('Project saved successfully!');
    } catch (error) {
      console.error('[FileMenu] Project save failed:', error);
      alert(`Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details.`);
    }
  };

  const handleLoadProject = async (file: File) => {
    try {
      const project = await importProject(file);
      
      // Clear existing state and graph cache
      graphEvaluator.clearCache();
      resetPatternFlow();
      resetTimeline();
      
      // Apply settings
      setTempo(project.settings.tempo);
      setBeatsPerMeasure(project.settings.beatsPerMeasure);
      setBeatUnit(project.settings.beatUnit);
      setPPQ(project.settings.ppq);
      setTimelineLeftBorder(project.settings.timelineLeftBorder);
      setTimelineRightBorder(project.settings.timelineRightBorder);
      setPatternEditorLeftBorder(project.settings.patternEditorLeftBorder);
      setPatternEditorRightBorder(project.settings.patternEditorRightBorder);
      
      // Apply PatternFlow state
      setNodes(project.nodes);
      setEdges(project.edges);
      
      // Apply Timeline state
      const timelineStore = useTimelineStore.getState();
      project.timelineItems.forEach(item => timelineStore.addItem(item));
      project.channelPrograms.forEach((program, channel) => {
        timelineStore.setChannelProgram(channel, program);
      });
      // Apply mute/solo states
      for (let ch = 0; ch < 16; ch++) {
        if (project.channelMuted[ch]) {
          // Set muted state directly
          useTimelineStore.setState(state => {
            const newMuted = [...state.channelMuted];
            newMuted[ch] = true;
            return { channelMuted: newMuted };
          });
        }
        if (project.channelSolo[ch]) {
          useTimelineStore.setState(state => {
            const newSolo = [...state.channelSolo];
            newSolo[ch] = true;
            return { channelSolo: newSolo };
          });
        }
      }
      timelineStore.setPixelsPerBeat(project.pixelsPerBeat);
      timelineStore.setPlaybackStartTime(project.playbackStartTime);
      timelineStore.setSnapEnabled(project.snapEnabled);
      timelineStore.setSnapDenominator(project.snapDenominator);
      
      setIsOpen(false);
      if (onViewChange) {
        onViewChange('patternflow');
      }
      alert(`Project loaded successfully!${project.projectName ? `\n\nProject: ${project.projectName}` : ''}`);
    } catch (error) {
      console.error('[FileMenu] Project load failed:', error);
      alert(`Failed to load project: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck console for details.`);
    }
  };



  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg px-4 py-1.5 bg-gray-700 text-white text-xs font-semibold transition-colors hover:bg-gray-600"
      >
        File
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="py-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 transition-colors"
            >
              📁 Import MIDI File...
            </button>
            <button
              onClick={handleExportTimeline}
              className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 transition-colors"
            >
              📦 Export Timeline as MIDI
            </button>
            <button
              onClick={handleExportPattern}
              className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 transition-colors"
            >
              📦 Export Pattern as MIDI
            </button>
            
            {/* Separator */}
            <div className="border-t border-gray-700 my-2" />
            
            <button
              onClick={handleSaveProject}
              className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 transition-colors"
            >
              💾 Save Project...
            </button>
            <button
              onClick={() => projectInputRef.current?.click()}
              className="w-full px-4 py-2 text-sm text-left text-gray-200 hover:bg-gray-700 transition-colors"
            >
              📂 Load Project...
            </button>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mid,.midi"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportMIDI(file);
          e.target.value = '';
        }}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".mdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLoadProject(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * Drag-and-drop zone for file import
 */
interface DropZoneProps {
  onImportMIDI: (patterns: Pattern[]) => void;
  onViewChange?: (view: 'patternflow' | 'settings' | 'pattern-editor') => void;
}

export function FileDropZone({ onImportMIDI, onViewChange }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
      try {
        const { patterns } = await importMIDI(file);
        onImportMIDI(patterns);
        if (onViewChange) {
          onViewChange('patternflow');
        }
      } catch (error) {
        alert(`Failed to import MIDI: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  if (!isDragging) return null;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed inset-0 bg-blue-500 bg-opacity-20 border-4 border-blue-500 border-dashed flex items-center justify-center z-50"
    >
      <div className="text-2xl font-bold text-white bg-blue-600 px-8 py-4 rounded-lg">
        Drop file to import
      </div>
    </div>
  );
}
