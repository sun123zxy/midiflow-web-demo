import { useImperativeHandle, useState, forwardRef } from 'react';
import Fraction from 'fraction.js';
import type { ParameterDefinition } from '@/types/patternflow';
import { 
  NumberInput, 
  FractionInput, 
  SliderInput, 
  BooleanInput, 
  CodeInput, 
  TextInput 
} from './inputs';

interface ParameterFormProps {
  parameters: Record<string, ParameterDefinition>;
  values: any;
  onChange: (values: any) => void;
  showEditButton?: boolean;
}

export interface ParameterFormHandle {
  startEditing: () => void;
}

// Helper function to convert MIDI note number to note name
function midiToNoteName(note: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = noteNames[note % 12];
  return `${noteName}${octave}`;
}

export const ParameterForm = forwardRef<ParameterFormHandle, ParameterFormProps>(({ parameters, values, onChange, showEditButton = true }, ref) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValues, setTempValues] = useState(values);
  
  const entries = Object.entries(parameters);
  if (entries.length === 0) return null;
  
  const handleEdit = () => {
    // Convert values to strings for editing
    const stringValues: any = {};
    for (const [key, def] of Object.entries(parameters)) {
      const value = values[key];
      if (def.type === 'fraction') {
        stringValues[key] = value?.toFraction?.() || String(value);
      } else if (def.type === 'number' || def.type === 'midi-note' || def.type === 'midi-128' || def.type === 'slider') {
        stringValues[key] = String(value);
      } else {
        stringValues[key] = value;
      }
    }
    setTempValues(stringValues);
    setIsEditing(true);
  };

  useImperativeHandle(ref, () => ({
    startEditing: handleEdit,
  }));
  
  const handleSave = () => {
    // Validate and convert string values to proper types
    const validatedValues: any = {};
    const errors: string[] = [];
    
    for (const [key, def] of Object.entries(parameters)) {
      const rawValue = tempValues[key];
      
      try {
        switch (def.type) {
          case 'fraction': {
            validatedValues[key] = new Fraction(rawValue);
            break;
          }
          case 'number':
          case 'midi-note':
          case 'midi-128': {
            const num = Number(rawValue);
            if (isNaN(num)) {
              errors.push(`${def.label}: Invalid number`);
              break;
            }
            if (def.range && (num < def.range[0] || num > def.range[1])) {
              errors.push(`${def.label}: Must be between ${def.range[0]} and ${def.range[1]}`);
              break;
            }
            validatedValues[key] = num;
            break;
          }
          case 'slider': {
            const num = Number(rawValue);
            validatedValues[key] = isNaN(num) ? (def.range?.[0] || 0) : num;
            break;
          }
          default:
            validatedValues[key] = rawValue;
        }
      } catch (error) {
        errors.push(`${def.label}: ${error instanceof Error ? error.message : 'Invalid format'}`);
      }
    }
    
    if (errors.length > 0) {
      alert('Please fix the following errors:\n\n' + errors.join('\n'));
      return;
    }
    
    onChange(validatedValues);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setTempValues(values);
    setIsEditing(false);
  };
  
  const handleChange = (key: string, newValue: any) => {
    setTempValues({ ...tempValues, [key]: newValue });
  };
  
  const renderParam = (key: string, def: ParameterDefinition) => {
    const value = isEditing ? tempValues[key] : values[key];
    
    if (!isEditing) {
      // Readonly display
      let displayValue = '';
      
      switch (def.type) {
        case 'fraction':
          displayValue = value?.toFraction ? value.toFraction() : String(value);
          break;
        case 'midi-note':
          displayValue = `${value} (${midiToNoteName(value)})`;
          break;
        case 'boolean':
          displayValue = value ? 'Yes' : 'No';
          break;
        case 'code':
          displayValue = String(value).slice(0, 30) + (String(value).length > 30 ? '...' : '');
          break;
        default:
          displayValue = String(value);
      }
      
      return (
        <div key={key} className="text-xs text-gray-400 font-mono">
          {def.label}: {displayValue}
        </div>
      );
    }
    
    // Editable inputs
    switch (def.type) {
      case 'number':
      case 'midi-note':
      case 'midi-128':
        return (
          <NumberInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
            definition={def}
          />
        );
        
      case 'fraction':
        return (
          <FractionInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
          />
        );
        
      case 'slider':
        return (
          <SliderInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
            definition={def}
          />
        );
        
      case 'boolean':
        return (
          <BooleanInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
          />
        );
        
      case 'code':
        return (
          <CodeInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
          />
        );
        
      default:
        return (
          <TextInput
            key={key}
            label={def.label}
            value={value}
            onChange={(newValue) => handleChange(key, newValue)}
          />
        );
    }
  };
  
  return (
    <div className="space-y-1 mb-1">
      {entries.map(([key, def]) => renderParam(key, def))}
      
      {/* Edit/Save/Cancel buttons */}
      <div className="flex gap-1 pt-0.5">
        {!isEditing ? (
          showEditButton ? (
          <button
            onClick={handleEdit}
            className="flex-1 px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
          >
            Edit
          </button>
          ) : null
        ) : (
          <>
            <button
              onClick={handleSave}
              className="flex-1 px-2 py-0.5 text-[10px] bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
});

ParameterForm.displayName = 'ParameterForm';
