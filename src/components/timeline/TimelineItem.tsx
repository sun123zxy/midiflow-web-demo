import type { TimelineItem as TimelineItemType } from '@/store/timelineStore';
import type { PatternFlowGraph } from '@/types/patternflow';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { PatternPreview } from '@/components/preview/PatternPreview';

interface TimelineItemProps {
  item: TimelineItemType;
  isSelected: boolean;
  pixelsPerBeat: number;
  timelineOffsetBeats: number;
  channelHeight: number;
  graph: PatternFlowGraph;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onDoubleClick: (e: React.MouseEvent, id: string) => void;
}

export function TimelineItem({
  item,
  isSelected,
  pixelsPerBeat,
  timelineOffsetBeats,
  channelHeight,
  graph,
  onMouseDown,
  onContextMenu,
  onDoubleClick,
}: TimelineItemProps) {
  // Evaluate pattern live
  const pattern = graphEvaluator.evaluate(graph, item.nodeId);
  const isValid = pattern !== null;
  
  // Get node name
  const node = graph.nodes.find(n => n.id === item.nodeId);
  const nodeName = node?.data.name || item.nodeId;
  
  const x = (item.time.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat;
  const y = item.channel * channelHeight;
  const patternDuration = pattern?.duration?.valueOf() || 1;
  const width = patternDuration * 4 * pixelsPerBeat;
  const blockHeight = channelHeight - 8;
  const isDisabled = !isValid;

  // Calculate actual range needed for all notes (including negative time and overflow)
  let minNoteStart = 0;
  let maxNoteEnd = patternDuration;
  if (pattern && pattern.notes.length > 0) {
    pattern.notes.forEach(([startTime, note]) => {
      const noteStart = startTime.valueOf();
      const noteEnd = noteStart + note.duration.valueOf();
      minNoteStart = Math.min(minNoteStart, noteStart);
      maxNoteEnd = Math.max(maxNoteEnd, noteEnd);
    });
  }
  
  // Preview dimensions and offset
  const previewOffsetX = minNoteStart * 4 * pixelsPerBeat; // Negative if notes start before 0
  const previewWidth = (maxNoteEnd - minNoteStart) * 4 * pixelsPerBeat;

  return (
    <div
      className={`absolute cursor-move rounded select-none ${
        isDisabled 
          ? 'border border-gray-600 bg-red-600/70' 
          : isSelected 
            ? 'border border-blue-400 bg-purple-600/30 hover:bg-purple-600/50' 
            : 'border border-gray-600 bg-purple-600/30 hover:bg-purple-600/50'
      } transition-colors`}
      style={{
        left: `${x}px`,
        top: `${y + 4}px`,
        width: `${Math.max(width, 20)}px`,
        height: `${blockHeight}px`,
      }}
      onMouseDown={(e) => onMouseDown(e, item.id)}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => onContextMenu(e, item.id)}
      onDoubleClick={(e) => onDoubleClick(e, item.id)}
    >
      {/* Pattern preview overlay - can extend beyond block in both directions */}
      {isValid && pattern && (
        <div 
          className="absolute top-0 opacity-40 pointer-events-none" 
          style={{ 
            left: `${previewOffsetX}px`,
            width: `${Math.max(previewWidth, 20)}px`, 
            height: `${blockHeight}px` 
          }}
        >

          <PatternPreview
            pattern={pattern}
            width={Math.max(previewWidth, 20)}
            height={blockHeight}
            timeScale={pixelsPerBeat}
            timeOffset={minNoteStart}
            showBoundaries={false}
            className="rounded"
          />
        </div>
      )}
      
      {/* Label */}
      <div className="relative z-10 px-2 py-1 text-xs text-white truncate flex items-center gap-1">
        {isDisabled && <span className="text-yellow-300">⚠</span>}
        {nodeName}
      </div>
    </div>
  );
}
