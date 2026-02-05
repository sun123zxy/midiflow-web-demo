import type { ParameterDefinition } from '@/types/patternflow';

interface NumberInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  definition: ParameterDefinition;
}

export function NumberInput({ label, value, onChange, definition }: NumberInputProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${definition.range?.[0] || 0} - ${definition.range?.[1] || 100}`}
        className="w-full px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 nopan nodrag"
      />
      {definition.unit && <span className="text-[9px] text-gray-500">{definition.unit}</span>}
    </div>
  );
}