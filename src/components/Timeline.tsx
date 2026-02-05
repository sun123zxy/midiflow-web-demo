import { useRef, useEffect, useState } from 'react';
import Fraction from 'fraction.js';
import { useTimelineStore } from '@/store/timelineStore';
import { usePatternFlowStore } from '@/store/patternFlowStore';
import { useSettingsStore } from '@/store/settingsStore';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { PlaybackState } from '@/engine/playback';
import { useTimelineSelection } from './timeline/useTimelineSelection';
import { useTimelineDrag } from './timeline/useTimelineDrag';
import { TimelineItem as TimelineItemComponent } from './timeline/TimelineItem';

const CHANNEL_HEIGHT = 48;
const CHANNEL_COUNT = 16;
const RULER_HEIGHT = 32;

// General MIDI Level 1 Instrument Patch Map
const GM_INSTRUMENTS = [
  // Piano (0-7)
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  // Chromatic Percussion (8-15)
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
  'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  // Organ (16-23)
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
  'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  // Guitar (24-31)
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  // Bass (32-39)
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
  'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  // Strings (40-47)
  'Violin', 'Viola', 'Cello', 'Contrabass',
  'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  // Ensemble (48-55)
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Choir', 'Orchestra Hit',
  // Brass (56-63)
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
  'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  // Reed (64-71)
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
  'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  // Pipe (72-79)
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
  'Blown bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  // Synth Lead (80-87)
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
  'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  // Synth Pad (88-95)
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
  'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  // Synth Effects (96-103)
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
  'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  // Ethnic (104-111)
  'Sitar', 'Banjo', 'Shamisen', 'Koto',
  'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
  // Percussive (112-119)
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
  'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  // Sound effects (120-127)
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
  'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot',
];

interface TimelineProps {
  playbackPosition?: Fraction | null;
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  midiInitialized: boolean;
}

export function Timeline({ playbackPosition, playbackState, onPlay, onPause, onStop, midiInitialized }: TimelineProps) {
  const {
    items,
    channelPrograms,
    channelMuted,
    channelSolo,
    pixelsPerBeat,
    scrollX,
    playbackStartTime,
    snapDenominator,
    selectedItemIds,
    setScrollX,
    setPixelsPerBeat,
    setPlaybackStartTime,
    setSnapDenominator,
    selectItems,
    clearSelection,
    setChannelProgram,
    toggleChannelMute,
    toggleChannelSolo,
    addItem,
    updateItem,
    removeItem,
    copySelection,
    pasteSelection,
    duplicateSelection,
  } = useTimelineStore();
  
  const { nodes, edges, selectedNodeId } = usePatternFlowStore();
  const { beatsPerMeasure, beatUnit, timelineLeftBorder, timelineRightBorder } = useSettingsStore();

  // Snap time to grid
  const snapTime = (time: Fraction): Fraction => {
    if (snapDenominator === 0) return time;
    const gridSize = new Fraction(1, snapDenominator);
    const snapped = time.div(gridSize).round().mul(gridSize);
    return snapped;
  };

  const [activeTool, setActiveTool] = useState<'pattern' | 'select'>('pattern');
  const [localZoom, setLocalZoom] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelLabelsRef = useRef<HTMLDivElement>(null);

  // Calculate dimensions first (needed by hooks)
  const timelineHeight = CHANNEL_COUNT * CHANNEL_HEIGHT;
  const totalMeasures = timelineRightBorder - timelineLeftBorder;
  const totalWidth = totalMeasures * beatsPerMeasure * pixelsPerBeat; // Total canvas width in pixels
  const timelineOffsetBeats = timelineLeftBorder * beatsPerMeasure; // Offset in beats for negative time

  // Use custom hooks for selection and drag
  const graph = { nodes, edges };
  const selection = useTimelineSelection({
    items,
    selectedItemIds,
    selectItems,
    clearSelection,
    pixelsPerBeat,
    timelineOffsetBeats,
    channelHeight: CHANNEL_HEIGHT,
    graph,
  });

  const drag = useTimelineDrag({
    items,
    selectedItemIds,
    updateItem,
    setPlaybackStartTime,
    pixelsPerBeat,
    timelineOffsetBeats,
    channelHeight: CHANNEL_HEIGHT,
    channelCount: CHANNEL_COUNT,
    beatsPerMeasure,
    timelineLeftBorder,
    timelineRightBorder,
    snapTime,
  })
  
  // Sync tool to 'pattern' when a node is selected in PatternFlow
  useEffect(() => {
    if (selectedNodeId && activeTool !== 'select') {
      setActiveTool('pattern');
    }
  }, [selectedNodeId]);
  
  // Auto-scroll to follow playback cursor
  useEffect(() => {
    if (!playbackPosition || !containerRef.current) return;
    
    const cursorX = (playbackPosition.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat;
    const container = containerRef.current;
    const viewportWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;
    
    // Auto-scroll if cursor is near the right edge or outside viewport
    if (cursorX > scrollLeft + viewportWidth - 100) {
      container.scrollLeft = cursorX - viewportWidth / 2;
    } else if (cursorX < scrollLeft + 100) {
      container.scrollLeft = Math.max(0, cursorX - 100);
    }
  }, [playbackPosition, pixelsPerBeat]);
  
  // Handle horizontal scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft);
    // Sync vertical scroll with channel labels
    if (channelLabelsRef.current) {
      channelLabelsRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };
  
  // Handle zoom (mouse wheel)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setPixelsPerBeat(pixelsPerBeat * delta);
    }
  };
  
  // Handle mouse down on timeline grid
  const handleGridMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top + scrollTop;
    
    // Region selection mode
    if (activeTool === 'select') {
      selection.startRegionSelection(x, y);
    }
  };
  
  // Handle click on timeline grid to place pattern
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't place if we were dragging or in select mode
    if (drag.isDragging || activeTool === 'select') return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top + scrollTop;
    
    const rawTime = new Fraction((x / pixelsPerBeat / 4) + (timelineOffsetBeats / 4));
    const time = snapTime(rawTime);
    const channel = Math.floor(y / CHANNEL_HEIGHT);
    
    if (channel < 0 || channel >= CHANNEL_COUNT) return;
    
    if (!selectedNodeId) {
      alert('No pattern selected!\n\nSelect a node in PatternFlow first.');
      return;
    }
    
    addItem({
      id: `item-${Date.now()}`,
      time,
      channel,
      nodeId: selectedNodeId,
    });
  };
  
  // Handle item mouse down - select and prepare drag
  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return; // Only left click
    
    // Select the item immediately (if not already selected)
    selection.selectSingleItem(itemId);
    
    // Prepare for drag
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const itemX = (item.time.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat;
    const itemY = item.channel * CHANNEL_HEIGHT;
    
    drag.startItemDrag(itemId, e.clientX, e.clientY, rect, itemX, itemY, scrollX, scrollTop);
  };
  
  // Handle item right-click
  const handleItemContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    removeItem(itemId);
  };

  const handleItemDoubleClick = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    window.dispatchEvent(new CustomEvent('patternflow:select-node', { detail: { nodeId: item.nodeId } }));
  };
  
  // Handle mouse move for drag and region selection
  const handleMouseMove = (e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    
    // Region selection mode
    if (selection.selectionRect && activeTool === 'select') {
      const x = e.clientX - rect.left + scrollX;
      const y = e.clientY - rect.top + scrollTop;
      selection.updateRegionSelection(x, y);
      return;
    }
    
    // Handle dragging
    if (drag.draggedItem) {
      drag.handleDragMove(e.clientX, e.clientY, rect, scrollX, scrollTop);
    }
  };
  
  // Handle mouse up
  const handleMouseUp = () => {
    // Finalize region selection
    if (selection.selectionRect && activeTool === 'select') {
      selection.finalizeRegionSelection();
    }
    
    // End drag
    drag.endDrag();
  };
  
  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedItemIds.length > 0) {
        selectedItemIds.forEach(id => removeItem(id));
        clearSelection();
      }
    }
    
    // Copy (Ctrl+C or Cmd+C)
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (selectedItemIds.length > 0) {
        e.preventDefault();
        copySelection();
      }
    }
    
    // Paste (Ctrl+V or Cmd+V)
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteSelection();
    }
    
    // Duplicate (Ctrl+D or Cmd+D)
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      duplicateSelection();
    }
  };
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemIds]);
  
  // Get selected pattern info for palette
  const selectedPattern = selectedNodeId ? graphEvaluator.evaluate({ nodes, edges }, selectedNodeId) : null;
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
  
  // Draw grid on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = totalWidth * dpr;
    canvas.height = timelineHeight * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${timelineHeight}px`;
    ctx.scale(dpr, dpr);
    
    // Clear
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, totalWidth, timelineHeight);
    
    // Draw vertical lines (beats) - account for left border offset
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    const startBeat = Math.floor(timelineOffsetBeats);
    const endBeat = Math.ceil(startBeat + totalMeasures * beatsPerMeasure);
    
    for (let beat = startBeat; beat <= endBeat; beat++) {
      const x = (beat - timelineOffsetBeats) * pixelsPerBeat;
      
      // Measure lines are thicker
      if (beat % beatsPerMeasure === 0) {
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
      }
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, timelineHeight);
      ctx.stroke();
    }
    
    // Draw horizontal lines (channels)
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    for (let channel = 0; channel <= CHANNEL_COUNT; channel++) {
      const y = channel * CHANNEL_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(totalWidth, y);
      ctx.stroke();
    }
  }, [pixelsPerBeat, beatsPerMeasure, beatUnit, totalWidth, timelineHeight, timelineOffsetBeats, totalMeasures]);
  
  // Render timeline items using component
  const renderItems = () => {
    return items.map((item) => (
      <TimelineItemComponent
        key={item.id}
        item={item}
        isSelected={selectedItemIds.includes(item.id)}
        pixelsPerBeat={pixelsPerBeat}
        timelineOffsetBeats={timelineOffsetBeats}
        channelHeight={CHANNEL_HEIGHT}
        graph={graph}
        onMouseDown={handleItemMouseDown}
        onContextMenu={handleItemContextMenu}
              onDoubleClick={handleItemDoubleClick}
      />
    ));
  };
  
  // Handle playback marker mouse down
  const handleMarkerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    drag.startMarkerDrag(e.clientX, e.clientY);
  };
  
  // Render program changes
  return (
    <div className="flex flex-col h-full bg-gray-900 border-t border-gray-700">
      {/* Combined Header & Toolbar */}
      <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* Title */}
          <h2 className="text-xs font-semibold text-gray-100">Timeline</h2>
          
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
              onClick={() => setActiveTool('pattern')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                activeTool === 'pattern'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              🎹 Pattern
            </button>
          </div>

          {/* Pattern Info */}
          <div className="px-2 py-1 bg-gray-900 rounded border border-gray-700 text-xs">
            {selectedNodeId && selectedPattern && selectedNode ? (
              <span className="text-green-400">
                ✓ Selected: <strong>{selectedNode.data.name}</strong> ({selectedPattern.notes.length} notes)
              </span>
            ) : (
              <span className="text-gray-500">No pattern selected. Select a node in PatternFlow.</span>
            )}
          </div>
          
          {/* Right Side Controls */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Zoom:</span>
              <input
                type="range"
                min="5"
                max="80"
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
            
            {/* Snap to Grid Controls */}
            <div className="flex items-center gap-2">
              <label htmlFor="snap-denominator" className="text-xs text-gray-400">
                Snap:
              </label>
              <select
                id="snap-denominator"
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
            
            {/* Playback Controls */}
            {midiInitialized && (
              <div className="flex gap-1.5">
                <button
                  onClick={onPlay}
                  disabled={playbackState === PlaybackState.PLAYING || items.length === 0}
                  className="rounded px-2 py-1 text-xs font-semibold transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  ▶
                </button>
                <button
                  onClick={onPause}
                  disabled={playbackState !== PlaybackState.PLAYING}
                  className="rounded bg-yellow-600 px-2 py-1 text-xs font-semibold transition-colors hover:bg-yellow-700 disabled:bg-gray-700 disabled:text-gray-500"
                >
                  ⏸
                </button>
                <button
                  onClick={onStop}
                  disabled={playbackState === PlaybackState.STOPPED || items.length === 0}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-semibold transition-colors hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500"
                >
                  ⏹
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Timeline Ruler */}
      <div className="relative bg-gray-800 border-b border-gray-700 overflow-hidden select-none" style={{ height: `${RULER_HEIGHT}px` }}>
        <div className="absolute left-0 w-48 h-full bg-gray-800 border-r border-gray-700 flex items-center justify-center text-xs text-gray-400 z-10">
            Channels
        </div>
        
        {/* Ruler markers */}
        <div 
          className="absolute left-48 right-0 h-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left + scrollX;
            const rawTime = new Fraction((x / pixelsPerBeat / 4) + (timelineOffsetBeats / 4));
            const time = snapTime(rawTime);
            setPlaybackStartTime(time);
          }}
        >
          <div 
            className="relative h-full"
            style={{ 
              width: `${totalWidth}px`,
              transform: `translateX(-${scrollX}px)`,
            }}
          >
            {Array.from({ length: totalMeasures + 1 }, (_, measureIndex) => {
              const measure = timelineLeftBorder + measureIndex;
              const beat = measure * beatsPerMeasure;
              const x = (beat - timelineOffsetBeats) * pixelsPerBeat;
              
              return (
                <div
                  key={measureIndex}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${x}px` }}
                >
                  {/* Tick mark */}
                  <div 
                    className="absolute bottom-0 h-4 bg-gray-400"
                    style={{ width: '1px' }}
                  />
                  
                  {/* Label for measures */}
                  <div className="absolute bottom-4 left-1 text-xs text-gray-400 font-mono">
                    {measure}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Timeline Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Channel Labels */}
        <div ref={channelLabelsRef} className="w-48 bg-gray-800 border-r border-gray-700 overflow-y-auto" style={{ overflowY: 'hidden' }}>
          {Array.from({ length: CHANNEL_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex flex-col items-start justify-center border-b border-gray-700 text-xs select-none px-2 gap-1"
              style={{ height: `${CHANNEL_HEIGHT}px` }}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-gray-400 font-semibold">Channel {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleChannelMute(i)}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      channelMuted[i] 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title={channelMuted[i] ? 'Unmute' : 'Mute'}
                  >
                    M
                  </button>
                  <button
                    onClick={() => toggleChannelSolo(i)}
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors ${
                      channelSolo[i] 
                        ? 'bg-yellow-500 text-black' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                    title={channelSolo[i] ? 'Unsolo' : 'Solo'}
                  >
                    S
                  </button>
                  {i !== 9 && (
                    <span className="w-4 text-center text-green-300 text-xs bg-gray-700 px-1 rounded">
                      {channelPrograms[i] + 1}
                    </span>
                  )}
                </div>
              </div>
              {i === 9 ? (
                <div className="w-full text-xs text-yellow-400 italic">
                  Percussion
                </div>
              ) : (
                <select
                  value={channelPrograms[i]}
                  onChange={(e) => setChannelProgram(i, Number(e.target.value))}
                  className="w-full text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                  title={GM_INSTRUMENTS[channelPrograms[i]]}
                >
                  {GM_INSTRUMENTS.map((name, program) => (
                    <option key={program} value={program}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        
        {/* Scrollable Timeline Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto relative"
          onScroll={handleScroll}
          onWheel={handleWheel}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <div 
            className="relative select-none" 
            style={{ width: `${totalWidth}px`, height: `${timelineHeight}px`, userSelect: 'none' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onMouseDown={handleGridMouseDown}
            onClick={handleGridClick}
          >
            {/* Grid Canvas */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0"
              style={{ pointerEvents: 'none' }}
            />
            
            {/* Dark overlay for time before 0 (not exported) */}
            {timelineOffsetBeats < 0 && (
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-10"
                style={{
                  left: 0,
                  width: `${(-timelineOffsetBeats) * pixelsPerBeat}px`,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }}
                title="This area (before time 0) is not exported"
              />
            )}
            
            {/* Timeline Items */}
            {renderItems()}
            
            {/* Region Selection Rectangle */}
            {selection.selectionRect && activeTool === 'select' && (
              <div
                className="absolute border-2 border-blue-500 pointer-events-none z-50"
                style={{
                  left: `${Math.min(selection.selectionRect.startX, selection.selectionRect.endX)}px`,
                  top: `${Math.min(selection.selectionRect.startY, selection.selectionRect.endY)}px`,
                  width: `${Math.abs(selection.selectionRect.endX - selection.selectionRect.startX)}px`,
                  height: `${Math.abs(selection.selectionRect.endY - selection.selectionRect.startY)}px`,
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                }}
              />
            )}
            
            {/* Playback Start Position */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-green-500 z-40 opacity-80 hover:opacity-100 cursor-ew-resize"
              style={{
                left: `${(playbackStartTime.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat - 2}px`,
              }}
              title="Playback Start (drag to move)"
              onMouseDown={handleMarkerMouseDown}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-8 border-l-transparent border-r-transparent border-t-green-500" />
            </div>
            
            {/* Playback Cursor */}
            {playbackPosition && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-50"
                style={{
                  left: `${(playbackPosition.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat}px`,
                }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-8 border-l-transparent border-r-transparent border-t-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
