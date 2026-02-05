import { useState, useEffect } from 'react';
import Fraction from 'fraction.js';
import { midiManager, MIDIManager, MIDIPlayback, PlaybackState } from '@/engine';
import { PatternFlow } from '@/components/PatternFlow';
import { Timeline } from '@/components/Timeline';
import { Settings } from '@/components/Settings';
import { PatternEditor } from '@/components/PatternEditor';
import { NodePalette } from '@/components/NodePalette';
import { FileMenu, FileDropZone } from '@/components/FileMenu';
import { ResizableSplit } from '@/components/ResizableSplit';
import { usePatternFlowStore } from '@/store/patternFlowStore';
import { useTimelineStore } from '@/store/timelineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { renderTimelineToMIDI } from '@/engine/timelineRenderer';

import type { Timeline as TimelineType, PlaybackConfig, Pattern } from '@/types';

function App() {
  const [midiInitialized, setMidiInitialized] = useState(false);
  const [patternflowPlayback] = useState(() => new MIDIPlayback(midiManager));
  const [timelinePlayback] = useState(() => new MIDIPlayback(midiManager));
  const [patternflowPlaybackState, setPatternflowPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [timelinePlaybackState, setTimelinePlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [timelinePlaybackPosition, setTimelinePlaybackPosition] = useState<Fraction>(new Fraction(0));
  const [activeView, setActiveView] = useState<'patternflow' | 'settings' | 'pattern-editor'>('patternflow');
  
  const { nodes, edges, addNode, selectedNodeId, selectNode } = usePatternFlowStore();
  const { playbackStartTime } = useTimelineStore();
  const { getTempoMicroseconds, ppq } = useSettingsStore();

  useEffect(() => {
    // Initialize MIDI
    const initMidi = async () => {
      try {
        await midiManager.init();
        setMidiInitialized(true);
      } catch (error) {
        console.error('Failed to initialize MIDI:', error);
      }
    };

    if (MIDIManager.isSupported()) {
      initMidi();
    } else {
      console.error('Web MIDI API not supported in this browser');
    }
  }, []);

  useEffect(() => {
    const handleEditNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId?: string }>;
      const nodeId = customEvent.detail?.nodeId;
      if (!nodeId) return;
      selectNode(nodeId);
      setActiveView('pattern-editor');
    };

    window.addEventListener('patternflow:edit-node', handleEditNode as EventListener);
    return () => window.removeEventListener('patternflow:edit-node', handleEditNode as EventListener);
  }, [selectNode]);

  useEffect(() => {
    const handleSelectNode = (event: Event) => {
      const customEvent = event as CustomEvent<{ nodeId?: string }>;
      const nodeId = customEvent.detail?.nodeId;
      if (!nodeId) return;
      selectNode(nodeId);
      setActiveView('patternflow');
    };

    window.addEventListener('patternflow:select-node', handleSelectNode as EventListener);
    return () => window.removeEventListener('patternflow:select-node', handleSelectNode as EventListener);
  }, [selectNode]);

  // Track playback position for Timeline cursor
  useEffect(() => {
    if (timelinePlaybackState !== PlaybackState.PLAYING) {
      setTimelinePlaybackPosition(new Fraction(0));
      return;
    }

    const interval = setInterval(() => {
      const currentMs = timelinePlayback.getCurrentTime();
      const tempo = getTempoMicroseconds();
      const quarterNotes = (currentMs * 1000) / tempo;
      const wholeNotes = quarterNotes / 4;
      const absoluteTime = new Fraction(wholeNotes).add(playbackStartTime);
      setTimelinePlaybackPosition(absoluteTime);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [timelinePlaybackState, timelinePlayback, playbackStartTime]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space bar for Timeline playback
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        
        if (timelinePlaybackState === PlaybackState.PLAYING) {
          handleTimelineStop();
        } else {
          handleTimelinePlay();
        }
      }

      // Enter key for PatternFlow playback (only when PatternFlow is active)
      if ((e.code === 'Enter' || e.key === 'Enter') && activeView === 'patternflow') {
        e.preventDefault();
        
        if (patternflowPlaybackState === PlaybackState.PLAYING) {
          handlePatternflowStop();
        } else {
          handlePatternflowPlay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [patternflowPlaybackState, timelinePlaybackState, activeView]);

  // File import handlers
  const handleImportMIDI = (patterns: Pattern[]) => {
    // Add imported patterns as pattern source nodes
    patterns.forEach((pattern, index) => {
      const id = `imported-${Date.now()}-${index}`;
      addNode({
        id,
        type: 'pattern-source',
        position: { x: 100, y: 100 + index * 150 },
        data: {
          type: 'pattern-source',
          name: `Imported ${index + 1}`,
          pattern,
        },
      });
    });
  };



  const handlePatternflowPlay = () => {
    if (!selectedNodeId) {
      return;
    }

    const pattern = graphEvaluator.evaluate({ nodes, edges }, selectedNodeId);
    
    if (!pattern || pattern.notes.length === 0) {
      alert('Selected node could not produce an output pattern!');
      return;
    }

    // Create a simple timeline with this pattern
    const timeline: TimelineType = {
      canvas: [[new Fraction(0), 0, pattern]],
    };

    const config: PlaybackConfig = {
      tempo: getTempoMicroseconds(),
      ppq,
      startTime: new Fraction(0),
      endTime: null,
      defaultPrograms: { 0: 0 },
    };

    patternflowPlayback.play(timeline, config);
    setPatternflowPlaybackState(PlaybackState.PLAYING);
  };

  const handlePatternflowPause = () => {
    patternflowPlayback.pause();
    setPatternflowPlaybackState(PlaybackState.PAUSED);
  };

  const handlePatternflowStop = () => {
    patternflowPlayback.stop();
    setPatternflowPlaybackState(PlaybackState.STOPPED);
  };

  const handleTimelinePlay = () => {
    // Get fresh state from store to ensure we have latest changes
    const freshState = useTimelineStore.getState();
    
    if (freshState.items.length === 0) {
      alert('Timeline is empty! Add patterns first.');
      return;
    }

    const { timeline, config } = renderTimelineToMIDI(
      freshState.items, 
      { nodes, edges }, // Pass the graph
      freshState.channelPrograms,
      freshState.channelMuted,
      freshState.channelSolo,
      getTempoMicroseconds(), 
      ppq
    );
    // Set start time from timeline store
    config.startTime = freshState.playbackStartTime;
    timelinePlayback.play(timeline, config);
    setTimelinePlaybackState(PlaybackState.PLAYING);
  };

  const handleTimelinePause = () => {
    timelinePlayback.pause();
    setTimelinePlaybackState(PlaybackState.PAUSED);
  };

  const handleTimelineStop = () => {
    timelinePlayback.stop();
    setTimelinePlaybackState(PlaybackState.STOPPED);
  };

  const handleNodeSelect = (nodeId: string | null) => {
    selectNode(nodeId);
  };

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-900 text-gray-100">
      <FileDropZone onImportMIDI={handleImportMIDI} onViewChange={setActiveView} />
      
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">MidiFlow</h1>
          <FileMenu onImportMIDI={handleImportMIDI} activeView={activeView} onViewChange={setActiveView} />
          
          {/* View Toggle for Upper Pane */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveView('patternflow')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeView === 'patternflow'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              PatternFlow
            </button>
            <button
              onClick={() => setActiveView('pattern-editor')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeView === 'pattern-editor'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              PianoRoll
            </button>
            <button
              onClick={() => setActiveView('settings')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                activeView === 'settings'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Settings
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* GitHub Link */}
          <a
            href="https://github.com/sun123zxy/midiflow-web-demo"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
            title="View on GitHub"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
          </a>
          
          {/* PatternFlow Playback Controls */}
          {midiInitialized && activeView === 'patternflow' && (
            <div className="flex gap-2">
              <button
                onClick={handlePatternflowPlay}
                disabled={
                  patternflowPlaybackState === PlaybackState.PLAYING ||
                  !selectedNodeId
                }
                className="rounded px-2 py-1 text-xs font-semibold transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                ▶
              </button>
              <button
                onClick={handlePatternflowPause}
                disabled={patternflowPlaybackState !== PlaybackState.PLAYING}
                className="rounded bg-yellow-600 px-2 py-1 text-xs font-semibold transition-colors hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500"
              >
                ⏸
              </button>
              <button
                onClick={handlePatternflowStop}
                disabled={patternflowPlaybackState === PlaybackState.STOPPED}
                className="rounded bg-red-600 px-2 py-1 text-xs font-semibold transition-colors hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500"
              >
                ⏹
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <ResizableSplit
          defaultSplit={66.67}
          top={
            <div className="relative h-full">
              {/* Upper Pane: PatternFlow, Settings, or Pattern Editor */}
              {activeView === 'patternflow' ? (
                <div className="flex h-full">
                  <NodePalette />
                  <div className="flex-1">
                    <PatternFlow onNodeSelect={handleNodeSelect} />
                  </div>
                </div>
              ) : activeView === 'settings' ? (
                <Settings />
              ) : (
                <PatternEditor />
              )}
            </div>
          }
          bottom={
            <div className="relative h-full">
              {/* Lower Pane: Timeline (always visible) */}
              <Timeline 
                playbackPosition={timelinePlaybackState === PlaybackState.PLAYING ? timelinePlaybackPosition : null}
                playbackState={timelinePlaybackState}
                onPlay={handleTimelinePlay}
                onPause={handleTimelinePause}
                onStop={handleTimelineStop}
                midiInitialized={midiInitialized}
              />
            </div>
          }
        />
      </main>
    </div>
  );
}

export default App;
