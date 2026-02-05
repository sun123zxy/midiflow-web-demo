interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ label, value, onChange }: TextInputProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-gray-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-1.5 py-0.5 text-xs bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500 nopan nodrag"
      />
    </div>
  );
}