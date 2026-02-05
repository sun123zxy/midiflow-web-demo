import { useState } from 'react';
import type { TimelineItem } from '@/store/timelineStore';
import type { PatternFlowGraph } from '@/types/patternflow';
import { graphEvaluator } from '@/engine/graphEvaluator';

interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface UseTimelineSelectionProps {
  items: TimelineItem[];
  selectedItemIds: string[];
  selectItems: (ids: string[]) => void;
  clearSelection: () => void;
  pixelsPerBeat: number;
  timelineOffsetBeats: number;
  channelHeight: number;
  graph: PatternFlowGraph;
}

export function useTimelineSelection({
  items,
  selectedItemIds,
  selectItems,
  clearSelection,
  pixelsPerBeat,
  timelineOffsetBeats,
  channelHeight,
  graph,
}: UseTimelineSelectionProps) {
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);

  // Start region selection
  const startRegionSelection = (x: number, y: number) => {
    setSelectionRect({ startX: x, startY: y, endX: x, endY: y });
  };

  // Update region selection during drag
  const updateRegionSelection = (x: number, y: number) => {
    if (!selectionRect) return;
    setSelectionRect({ ...selectionRect, endX: x, endY: y });
  };

  // Finalize region selection
  const finalizeRegionSelection = () => {
    if (!selectionRect) return;

    const { startX, startY, endX, endY } = selectionRect;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    // Find items within selection rectangle
    const selectedItems: string[] = [];
    
    items.forEach(item => {
      const itemX = (item.time.valueOf() * 4 - timelineOffsetBeats) * pixelsPerBeat;
      const itemY = item.channel * channelHeight;
      const pattern = graphEvaluator.evaluate(graph, item.nodeId);
      const itemWidth = (pattern?.duration?.valueOf() || 1) * 4 * pixelsPerBeat;
      const itemHeight = channelHeight;
      
      // Check intersection
      if (itemX + itemWidth >= minX && itemX <= maxX &&
          itemY + itemHeight >= minY && itemY <= maxY) {
        selectedItems.push(item.id);
      }
    });

    // Update selection
    if (selectedItems.length > 0) {
      selectItems(selectedItems);
    } else {
      clearSelection();
    }
    
    setSelectionRect(null);
  };

  // Cancel region selection
  const cancelRegionSelection = () => {
    setSelectionRect(null);
  };

  // Select single item (on mousedown)
  const selectSingleItem = (itemId: string) => {
    // If clicking an already selected item, keep selection (for multi-drag)
    // Otherwise, select only this item
    if (!selectedItemIds.includes(itemId)) {
      selectItems([itemId]);
    }
  };

  return {
    selectionRect,
    startRegionSelection,
    updateRegionSelection,
    finalizeRegionSelection,
    cancelRegionSelection,
    selectSingleItem,
  };
}
