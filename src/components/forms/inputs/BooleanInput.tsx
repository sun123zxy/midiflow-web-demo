interface BooleanInputProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanInput({ label, value, onChange }: BooleanInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3 h-3 nopan nodrag"
      />
      <label className="text-xs text-gray-300">{label}</label>
    </div>
  );
}