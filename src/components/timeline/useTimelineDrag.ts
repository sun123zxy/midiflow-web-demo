import { useState } from 'react';
import Fraction from 'fraction.js';
import type { TimelineItem } from '@/store/timelineStore';

interface DragState {
  type: 'item' | 'startMarker';
  id?: string;
}

interface MousePos {
  x: number;
  y: number;
}

interface DragOffset {
  x: number;
  y: number;
}

interface UseTimelineDragProps {
  items: TimelineItem[];
  selectedItemIds: string[];
  updateItem: (id: string, updates: Partial<TimelineItem>) => void;
  setPlaybackStartTime: (time: Fraction) => void;
  pixelsPerBeat: number;
  timelineOffsetBeats: number;
  channelHeight: number;
  channelCount: number;
  beatsPerMeasure: number;
  timelineLeftBorder: number;
  timelineRightBorder: number;
  snapTime: (time: Fraction) => Fraction;
}

export function useTimelineDrag({
  items,
  selectedItemIds,
  updateItem,
  setPlaybackStartTime,
  pixelsPerBeat,
  timelineOffsetBeats,
  channelHeight,
  channelCount,
  beatsPerMeasure,
  timelineLeftBorder,
  timelineRightBorder,
  snapTime,
}: UseTimelineDragProps) {
  const [draggedItem, setDraggedItem] = useState<DragState | null>(null);
  const [dragOffset, setDragOffset] = useState<DragOffset>({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<MousePos | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Start drag for timeline item
  const startItemDrag = (itemId: string, clientX: number, clientY: number, containerRect: DOMRect, itemX: number, itemY: number, scrollX: number, scrollTop: number) => {
    setMouseDownPos({ x: clientX, y: clientY });
    setDragOffset({
      x: clientX - containerRect.left - itemX + scrollX,
      y: clientY - containerRect.top - itemY + scrollTop,
    });
    setDraggedItem({ type: 'item', id: itemId });
  };

  // Start drag for playback start marker
  const startMarkerDrag = (clientX: number, clientY: number) => {
    setMouseDownPos({ x: clientX, y: clientY });
    setDraggedItem({ type: 'startMarker' });
  };

  // Handle drag movement
  const handleDragMove = (clientX: number, clientY: number, containerRect: DOMRect, scrollX: number, scrollTop: number) => {
    if (!draggedItem) return;

    const x = clientX - containerRect.left + scrollX;
    const y = clientY - containerRect.top + scrollTop;

    // Handle playback marker drag
    if (draggedItem.type === 'startMarker') {
      const rawTime = new Fraction((x / pixelsPerBeat / 4) + (timelineOffsetBeats / 4));
      const time = snapTime(rawTime);
      setPlaybackStartTime(time);
      setIsDragging(true);
      return;
    }

    // Check if we should start dragging (3px threshold)
    if (mouseDownPos && !isDragging) {
      const dx = clientX - mouseDownPos.x;
      const dy = clientY - mouseDownPos.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        return; // Not enough movement
      }
    }

    setIsDragging(true);
    setMouseDownPos(null);

    // Calculate new position with clamping
    const dragX = x - dragOffset.x;
    const dragY = y - dragOffset.y;
    
    const rawTime = new Fraction((dragX / pixelsPerBeat / 4) + (timelineOffsetBeats / 4));
    const minTime = new Fraction(timelineLeftBorder * beatsPerMeasure, 4);
    const maxTime = new Fraction(timelineRightBorder * beatsPerMeasure, 4);
    
    let clampedRawTime = rawTime;
    if (rawTime.compare(minTime) < 0) clampedRawTime = minTime;
    if (rawTime.compare(maxTime) > 0) clampedRawTime = maxTime;
    
    const time = snapTime(clampedRawTime);
    const channel = Math.max(0, Math.min(channelCount - 1, Math.floor(dragY / channelHeight)));

    if (draggedItem.type === 'item' && draggedItem.id) {
      // Get the dragged item's original position
      const draggedItemObj = items.find(i => i.id === draggedItem.id);
      if (!draggedItemObj) return;

      // Calculate offset
      const deltaTime = time.sub(draggedItemObj.time);
      const deltaChannel = channel - draggedItemObj.channel;

      // Update dragged item
      updateItem(draggedItem.id, { time, channel });

      // Update other selected items
      selectedItemIds.forEach(id => {
        if (id !== draggedItem.id) {
          const item = items.find(i => i.id === id);
          if (item) {
            const rawNewTime = item.time.add(deltaTime);
            let clampedNewTime = rawNewTime;
            if (rawNewTime.compare(minTime) < 0) clampedNewTime = minTime;
            if (rawNewTime.compare(maxTime) > 0) clampedNewTime = maxTime;
            const newChannel = Math.max(0, Math.min(channelCount - 1, item.channel + deltaChannel));
            updateItem(id, { time: clampedNewTime, channel: newChannel });
          }
        }
      });
    }
  };

  // End drag
  const endDrag = () => {
    setDraggedItem(null);
    setMouseDownPos(null);
    // Clear isDragging after short delay to prevent click event
    if (isDragging) {
      setTimeout(() => setIsDragging(false), 100);
    }
  };

  return {
    draggedItem,
    isDragging,
    startItemDrag,
    startMarkerDrag,
    handleDragMove,
    endDrag,
  };
}
