import { LABEL_PROFILES } from '../../types/label'
import type { LabelDisplayOrientation, LabelProfile } from '../../types/label'

interface LabelSettingsProps {
  labelProfile: LabelProfile
  displayOrientation: LabelDisplayOrientation
  density: number
  cornerStyle: 'rect' | 'rounded'
  onProfileChange: (presetId: string) => void
  onChange: (patch: Partial<Pick<{ display_orientation: LabelDisplayOrientation; density: number; corner_style: 'rect' | 'rounded' }, 'display_orientation' | 'density' | 'corner_style'>>) => void
}

const TYPE_LABELS: Record<string, string> = {
  simple: 'Simple',
  double: 'Double',
  cable: 'Cable',
}

export function LabelSettings({
  labelProfile,
  displayOrientation,
  density,
  cornerStyle,
  onProfileChange,
  onChange,
}: LabelSettingsProps) {
  const groups = ['simple', 'double', 'cable'] as const

  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Label profile</span>
        <select
          className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
          value={labelProfile.id}
          onChange={(e) => onProfileChange(e.target.value)}
        >
          {groups.map((type) => (
            <optgroup key={type} label={TYPE_LABELS[type]}>
              {LABEL_PROFILES.filter((p) => p.type === type).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Corner style</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ corner_style: 'rect' })}
            className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
              cornerStyle === 'rect'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
            }`}
          >
            Rect
          </button>
          <button
            type="button"
            onClick={() => onChange({ corner_style: 'rounded' })}
            className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
              cornerStyle === 'rounded'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
            }`}
          >
            Rounded
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Orientation</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ display_orientation: 'landscape' })}
            className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
              displayOrientation === 'landscape'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
            }`}
          >
            Landscape ↔
          </button>
          <button
            type="button"
            onClick={() => onChange({ display_orientation: 'portrait' })}
            className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
              displayOrientation === 'portrait'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
            }`}
          >
            Portrait ↕
          </button>
        </div>
      </div>

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
