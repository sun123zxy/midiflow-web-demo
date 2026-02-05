import { useRef, useState } from 'react';
import { Handle, Position, useEdges } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ModifierNodeData, KeywordInput, PositionalInput } from '@/types/patternflow';
import { getModifier } from '@/engine/modifiers';
import { graphEvaluator } from '@/engine/graphEvaluator';
import { usePatternFlowStore } from '@/store/patternFlowStore';
import { PatternPreview } from '@/components/preview/PatternPreview';
import { ParameterForm, type ParameterFormHandle } from '@/components/forms/ParameterForm';

export function ModifierNode({ data, selected, id }: NodeProps) {
  const typedData = data as ModifierNodeData;
  const modifierName = typedData.modifierType;
  const params = typedData.params;
  const edges = useEdges();
  const [showPreview, setShowPreview] = useState(false); // Default collapsed for modifiers
  const formRef = useRef<ParameterFormHandle>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(typedData.name);
  
  const { nodes, edges: allEdges, updateNodeData } = usePatternFlowStore();

  // Get modifier definition from registry
  const modifierDef = getModifier(params.modifier);

  // Separate keyword and positional inputs
  const keywordInputs = (modifierDef?.inputs || []).filter(
    (input): input is KeywordInput => input.type === 'keyword'
  );
  const positionalInput = (modifierDef?.inputs || []).find(
    (input): input is PositionalInput => input.type === 'positional'
  );

  // Get current positional input count
  const currentPositionalCount = typedData.positionalInputCount ?? (positionalInput?.minCount || 0);
  const connectedPositionalCount = edges.filter(
    e => e.target === id && e.targetHandle?.startsWith('pos-')
  ).length;
  const positionalCount = Math.max(currentPositionalCount, connectedPositionalCount, positionalInput?.minCount || 0);

  // Handlers for adding/removing positional inputs
  const addPositionalInput = () => {
    updateNodeData(id, { positionalInputCount: positionalCount + 1 });
  };

  const removePositionalInput = () => {
    if (positionalCount > (positionalInput?.minCount || 1)) {
      updateNodeData(id, { positionalInputCount: positionalCount - 1 });
    }
  };

  // Evaluate pattern for this node
  const pattern = graphEvaluator.evaluate({ nodes, edges: allEdges }, id);

  // Calculate handle positions
  const titleHeight = 24;
  const hasParams = modifierDef && Object.keys(modifierDef.parameters).length > 0;
  const paramsHeight = hasParams ? 20 : 0;
  const keywordInputHeight = keywordInputs.length * 32; // Each keyword input ~32px with margins
  const controlsHeight = positionalInput ? 32 : 0;
  const baseOffset = titleHeight + paramsHeight + keywordInputHeight + controlsHeight;
  const handleSpacing = 16;

  return (
    <div
      className={`px-2.5 py-2 rounded shadow-lg border bg-gray-800 text-gray-100 ${
        selected ? 'border-purple-500' : 'border-gray-600'
      }`}
      style={{
        minHeight: positionalInput ? `${baseOffset + (positionalCount - 1) * handleSpacing + 20}px` : 'auto'
      }}
    >
      {/* Positional inputs */}
      {positionalInput && Array.from({ length: positionalCount }, (_, i) => (
        <Handle
          key={`pos-${i}`}
          type="target"
          position={Position.Left}
          id={`pos-${i}`}
          className="w-2.5 h-2.5 bg-purple-500!"
          style={{ top: `${baseOffset + i * handleSpacing}px` }}
        />
      ))}

      {/* Title and header */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full bg-purple-500" />
        <div className="font-semibold text-xs capitalize">{modifierName}</div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => formRef.current?.startEditing()}
            className="nodrag text-[10px] text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded px-1.5 py-0.5 transition-colors"
            title="Edit parameters"
          >
            ✎
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="nodrag text-gray-400 hover:text-gray-200 transition-colors"
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${showPreview ? '' : 'rotate-180'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Editable name subtitle */}
      {isEditingName ? (
        <input
          autoFocus
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onBlur={() => {
            setIsEditingName(false);
            if (editedName.trim()) {
              updateNodeData(id, { name: editedName.trim() });
            } else {
              setEditedName(typedData.name);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setEditedName(typedData.name);
              setIsEditingName(false);
            }
          }}
          className="nodrag w-full text-[10px] text-gray-300 bg-gray-700 px-1 py-0.5 rounded mb-1.5 outline-none focus:ring-1 focus:ring-purple-500"
        />
      ) : (
        <div
          onClick={() => setIsEditingName(true)}
          className="nodrag text-[10px] text-gray-400 mb-1.5 cursor-text hover:text-gray-300 px-1"
          title="Click to edit name"
        >
          {typedData.name}
        </div>
      )}
      
      {/* Parameter form */}
      {modifierDef && (
        <ParameterForm
          ref={formRef}
          parameters={modifierDef.parameters}
          values={params}
          onChange={(newParams) => {
            updateNodeData(id, { params: { ...params, ...newParams } });
          }}
          showEditButton={false}
        />
      )}

      {/* Keyword inputs */}
      {keywordInputs.map((input) => (
        <div
          key={input.key}
          className="flex items-center gap-2 my-1 relative"
        >
          <Handle
            type="target"
            position={Position.Left}
            id={input.key}
            className="w-2.5 h-2.5 bg-purple-500!"
            style={{ left: '-10px' }}
          />
          <span className="text-[10px] text-gray-400 whitespace-nowrap">
            {input.label}
          </span>
        </div>
      ))}

      {/* Positional input controls */}
      {positionalInput && (
        <div className="flex items-center gap-1 mt-1 mb-1">
          <button
            onClick={removePositionalInput}
            disabled={positionalCount <= (positionalInput.minCount || 1)}
            className="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed rounded"
            title="Remove input"
          >
            −
          </button>
          <span className="text-[10px] text-gray-500">
            {positionalCount} {positionalInput.label || 'inputs'}
          </span>
          <button
            onClick={addPositionalInput}
            className="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded"
            title="Add input"
          >
            +
          </button>
        </div>
      )}

      {/* Collapsible preview */}
      {showPreview && (
        <div className="mt-2 border border-gray-700 rounded overflow-hidden">
          <PatternPreview
            pattern={pattern}
            width={200}
            height={60}
            showBoundaries={true}
          />
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-2.5 h-2.5 bg-purple-500!"
      />
    </div>
  );
}
