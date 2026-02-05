import type { ParameterDefinition } from '@/types/patternflow';

interface SliderInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  definition: ParameterDefinition;
}

export function SliderInput({ label, value, onChange, definition }: SliderInputProps) {
  const numValue = Number(value) || 0;
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-gray-400 flex justify-between">
        <span>{label}</span>
        <span className="font-mono">{numValue}{definition.unit || ''}</span>
      </label>
      <input
        type="range"
        value={numValue}
        onChange={(e) => onChange(e.target.value)}
        min={definition.range?.[0] || 0}
        max={definition.range?.[1] || 100}
        step={definition.step || 1}
        className="w-full nopan nodrag"
      />
    </div>
  );
}