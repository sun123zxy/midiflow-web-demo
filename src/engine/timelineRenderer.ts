import Fraction from 'fraction.js';
import type { Timeline, PlaybackConfig } from '@/types';
import type { TimelineItem } from '@/store/timelineStore';
import type { PatternFlowGraph } from '@/types/patternflow';
import { graphEvaluator } from '@/engine/graphEvaluator';

export function renderTimelineToMIDI(
  items: TimelineItem[],
  graph: PatternFlowGraph,
  channelPrograms: number[],
  channelMuted: boolean[],
  channelSolo: boolean[],
  tempo: number = 500000, // microseconds per quarter note
  ppq: number = 480
): { timeline: Timeline; config: PlaybackConfig } {
  // Determine which channels should be heard
  const hasSolo = channelSolo.some(s => s);
  const isChannelActive = (channel: number): boolean => {
    if (hasSolo) {
      return channelSolo[channel]; // Only solo channels are active
    }
    return !channelMuted[channel]; // Non-muted channels are active
  };
  
  // Build timeline canvas
  const canvas: Timeline['canvas'] = [];
  
  // Add patterns (fetch live from graph evaluator, filter by mute/solo)
  items.forEach((item) => {
    if (!isChannelActive(item.channel)) return; // Skip muted/non-solo channels
    
    const pattern = graphEvaluator.evaluate(graph, item.nodeId);
    if (pattern) {
      canvas.push([item.time, item.channel, pattern]);
    }
  });
  
  // Sort canvas by time
  canvas.sort((a, b) => a[0].compare(b[0]));
  
  // Calculate end time (only from valid items)
  let maxTime = new Fraction(0);
  items.forEach((item) => {
    const pattern = graphEvaluator.evaluate(graph, item.nodeId);
    if (pattern) {
      const endTime = item.time.add(pattern.duration || new Fraction(0));
      if (endTime.compare(maxTime) > 0) {
        maxTime = endTime;
      }
    }
  });
  
  // Build default programs from channelPrograms array
  const defaultPrograms: Record<number, number> = {};
  for (let channel = 0; channel < 16; channel++) {
    defaultPrograms[channel] = channelPrograms[channel] || 0;
  }
  
  const timeline: Timeline = { canvas };
  
  const config: PlaybackConfig = {
    tempo,
    ppq,
    startTime: new Fraction(0),
    endTime: null, // Don't auto-stop timeline playback
    defaultPrograms,
  };
  
  return { timeline, config };
}
