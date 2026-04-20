interface LabelSettingsProps {
  labelType: number
  density: number
  onChange: (s: { labelType?: number; density?: number }) => void
}

interface MediaOption {
  value: number
  label: string
}

const MEDIA_OPTIONS: MediaOption[] = [
  { value: 1, label: 'Standard (gaps)' },
  { value: 2, label: 'Black labels' },
  { value: 3, label: 'Continuous' },
  { value: 5, label: 'Transparent' },
]

export function LabelSettings({ labelType, density, onChange }: LabelSettingsProps) {
  return (
    <div className="flex flex-col gap-3 p-4 border-t border-white/10">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Label settings</p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Media type</span>
        <select
          className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
          value={labelType}
          onChange={(e) => onChange({ labelType: Number(e.target.value) })}
        >
          {MEDIA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Density ({density})</span>
        <input
          type="range"
          min={1}
          max={5}
          value={density}
          onChange={(e) => onChange({ density: Number(e.target.value) })}
          className="w-full"
        />
      </label>
    </div>
  )
}
