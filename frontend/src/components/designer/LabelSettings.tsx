import type {
  LabelCornerStyle,
  LabelOrientation,
  LabelSize,
} from '../../types/label'

interface LabelSettingsProps {
  labelType: number
  density: number
  cornerStyle: LabelCornerStyle
  orientation: LabelOrientation
  labelSize: LabelSize
  onLabelSizeChange: (size: LabelSize) => void
  onChange: (s: {
    labelType?: number
    density?: number
    cornerStyle?: LabelCornerStyle
    orientation?: LabelOrientation
  }) => void
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

const LABEL_SIZES: { value: LabelSize; label: string }[] = [
  { value: '50x30', label: '50×30mm' },
  { value: '30x30', label: '30×30mm' },
  { value: '30x50', label: '30×50mm' },
]

export function LabelSettings({
  labelType,
  density,
  cornerStyle,
  orientation,
  labelSize,
  onLabelSizeChange,
  onChange,
}: LabelSettingsProps) {
  const showOrientation = labelSize === '50x30'

  return (
    <div className="flex flex-col gap-3 p-4">
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

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Label size</span>
        <div className="flex gap-2">
          {LABEL_SIZES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLabelSizeChange(opt.value)}
              className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
                labelSize === opt.value
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Corner style</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ cornerStyle: 'rect' })}
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
            onClick={() => onChange({ cornerStyle: 'rounded' })}
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

      {showOrientation && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">Orientation</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ orientation: 'landscape' })}
              className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
                orientation === 'landscape'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
              }`}
            >
              Landscape ↔
            </button>
            <button
              type="button"
              onClick={() => onChange({ orientation: 'portrait' })}
              className={`flex-1 text-xs px-2 py-1.5 rounded transition-colors border ${
                orientation === 'portrait'
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
              }`}
            >
              Portrait ↕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
