import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { PatternNodeData } from '@/types/patternflow';
import { PatternPreview } from '@/components/preview/PatternPreview';
import { usePatternFlowStore } from '@/store/patternFlowStore';

export function PatternSourceNode({ data, selected, id }: NodeProps) {
  const typedData = data as PatternNodeData;
  const noteCount = typedData.pattern.notes.length;
  const [showPreview, setShowPreview] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(typedData.name);
  const { updateNodeData } = usePatternFlowStore();

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('patternflow:edit-node', { detail: { nodeId: id } }));
  };

  return (
    <div
      className={`px-2.5 py-2 rounded shadow-lg border bg-gray-800 text-gray-100 ${
        selected ? 'border-blue-500' : 'border-gray-600'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <div className="font-semibold text-xs">Pattern</div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleEdit}
            className="nodrag text-[10px] text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded px-1.5 py-0.5 transition-colors"
            title="Edit pattern"
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
          className="nodrag w-full text-[10px] text-gray-300 bg-gray-700 px-1 py-0.5 rounded mb-1 outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <div
          onClick={() => setIsEditingName(true)}
          className="nodrag text-[10px] text-gray-400 mb-1 cursor-text hover:text-gray-300 px-1"
          title="Click to edit name"
        >
          {typedData.name}
        </div>
      )}
      
      <div className="text-xs text-gray-400 mb-1">
        {noteCount} note{noteCount !== 1 ? 's' : ''}
      </div>

      {/* Collapsible preview */}
      {showPreview && (
        <div className="mt-2 border border-gray-700 rounded overflow-hidden">
          <PatternPreview
            pattern={typedData.pattern}
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
        className="w-3 h-3 bg-blue-500!"
      />
    </div>
  );
}
