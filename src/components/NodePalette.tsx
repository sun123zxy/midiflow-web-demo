import { useCallback } from 'react';
import { usePatternFlowStore } from '@/store/patternFlowStore';
import { useTimelineStore } from '@/store/timelineStore';
import { useSettingsStore } from '@/store/settingsStore';
import { createPattern } from '@/engine/pattern';
import { getAllModifiers, getDefaultParams } from '@/engine/modifiers';
import { importProject } from '@/utils/projectIO';
import { graphEvaluator } from '@/engine/graphEvaluator';
import type { PatternFlowNode } from '@/types/patternflow';
import exampleMDF from '@/assets/example.mdf?raw';

export function NodePalette() {
  const addNode = usePatternFlowStore((state) => state.addNode);
  const selectNode = usePatternFlowStore((state) => state.selectNode);
  const nodes = usePatternFlowStore((state) => state.nodes);
  const setNodes = usePatternFlowStore((state) => state.setNodes);
  const setEdges = usePatternFlowStore((state) => state.setEdges);
  const reset = usePatternFlowStore((state) => state.reset);
  const resetPatternFlow = usePatternFlowStore((state) => state.reset);
  const resetTimeline = useTimelineStore((state) => state.reset);
  
  const {
    setTempo,
    setBeatsPerMeasure,
    setBeatUnit,
    setPPQ,
    setTimelineLeftBorder,
    setTimelineRightBorder,
    setPatternEditorLeftBorder,
    setPatternEditorRightBorder,
  } = useSettingsStore();

  const loadDemo = useCallback(async () => {
    try {
      // Parse the example.mdf content
      const project = JSON.parse(exampleMDF);
      
      // Create a fake File object for importProject
      const blob = new Blob([exampleMDF], { type: 'application/json' });
      const file = new File([blob], 'example.mdf', { type: 'application/json' });
      
      const importedProject = await importProject(file);
      
      // Clear existing state and graph cache
      graphEvaluator.clearCache();
      resetPatternFlow();
      resetTimeline();
      
      // Apply settings
      setTempo(importedProject.settings.tempo);
      setBeatsPerMeasure(importedProject.settings.beatsPerMeasure);
      setBeatUnit(importedProject.settings.beatUnit);
      setPPQ(importedProject.settings.ppq);
      setTimelineLeftBorder(importedProject.settings.timelineLeftBorder);
      setTimelineRightBorder(importedProject.settings.timelineRightBorder);
      setPatternEditorLeftBorder(importedProject.settings.patternEditorLeftBorder);
      setPatternEditorRightBorder(importedProject.settings.patternEditorRightBorder);
      
      // Apply PatternFlow state
      setNodes(importedProject.nodes);
      setEdges(importedProject.edges);
      
      // Apply Timeline state
      const timelineStore = useTimelineStore.getState();
      importedProject.timelineItems.forEach(item => timelineStore.addItem(item));
      importedProject.channelPrograms.forEach((program, channel) => {
        timelineStore.setChannelProgram(channel, program);
      });
      
      // Apply mute/solo states
      for (let ch = 0; ch < 16; ch++) {
        if (importedProject.channelMuted[ch]) {
          useTimelineStore.setState(state => {
            const newMuted = [...state.channelMuted];
            newMuted[ch] = true;
            return { channelMuted: newMuted };
          });
        }
        if (importedProject.channelSolo[ch]) {
          useTimelineStore.setState(state => {
            const newSolo = [...state.channelSolo];
            newSolo[ch] = true;
            return { channelSolo: newSolo };
          });
        }
      }
    } catch (error) {
      console.error('Failed to load demo:', error);
    }
  }, [
    resetPatternFlow,
    resetTimeline,
    setNodes,
    setEdges,
    setTempo,
    setBeatsPerMeasure,
    setBeatUnit,
    setPPQ,
    setTimelineLeftBorder,
    setTimelineRightBorder,
    setPatternEditorLeftBorder,
    setPatternEditorRightBorder,
  ]);

  const addPatternNode = useCallback(() => {
    const id = `pattern-${Date.now()}`;
    const position = {
      x: Math.random() * 400,
      y: Math.random() * 300,
    };

    const patternCount = nodes.filter((n) => n.type === 'pattern-source').length + 1;
    const newNode: PatternFlowNode = {
      id,
      type: 'pattern-source',
      position,
      data: {
        type: 'pattern-source',
        name: `Pattern ${patternCount}`,
        pattern: createPattern(),
      },
    };

    addNode(newNode);
    selectNode(id);
  }, [addNode, selectNode, nodes]);

  const addModifierNode = useCallback(
    (modifierName: string) => {
      const id = `modifier-${Date.now()}`;
      const position = {
        x: Math.random() * 400,
        y: Math.random() * 300,
      };

      // Get default parameters from modifier registry
      const modifiers = getAllModifiers();
      const modifierDef = modifiers.find(m => m.name === modifierName);
      const params = modifierDef ? getDefaultParams(modifierDef) : { modifier: modifierName as any };

      const modifierCount = nodes.filter((n) => n.type === 'modifier').length + 1;
      const newNode: PatternFlowNode = {
        id,
        type: 'modifier',
        position,
        data: {
          type: 'modifier',
          modifierType: modifierName as any,
          params: params as any,
          name: `${modifierDef?.label || modifierName} ${modifierCount}`,
        },
      };

      addNode(newNode);
      selectNode(id);
    },
    [addNode, selectNode]
  );



  return (
    <div className="h-full bg-gray-800 border-r border-gray-700 p-2.5 overflow-y-auto" style={{ width: '250px' }}>
      <h3 className="font-semibold mb-2 text-xs text-gray-100">Node Palette</h3>

      {/* Pattern Sources */}
      <div className="mb-2.5">
        <div className="text-xs text-gray-400 mb-1.5 font-semibold">Sources</div>
        <button
          onClick={addPatternNode}
          className="w-full px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          + Pattern
        </button>
      </div>

      {/* Modifiers - dynamically generated from registry */}
      <div className="mb-2.5">
        <div className="text-xs text-gray-400 mb-1.5 font-semibold">Modifiers</div>
        <div className="grid grid-cols-2 gap-1.5">
          {getAllModifiers().map((modifierDef) => (
            <button
              key={modifierDef.name}
              onClick={() => addModifierNode(modifierDef.name)}
              className="px-1.5 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors capitalize"
            >
              {modifierDef.displayName}
            </button>
          ))}
        </div>
      </div>

      {/* Demo & Actions */}
      <div className="border-t border-gray-700 pt-2.5 space-y-1.5">
        <button
          onClick={loadDemo}
          className="w-full px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Load Demo
        </button>
        <button
          onClick={reset}
          className="w-full px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
