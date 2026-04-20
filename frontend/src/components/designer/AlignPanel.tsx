import Icon from '@mdi/react'
import {
  mdiAlignHorizontalLeft,
  mdiAlignHorizontalCenter,
  mdiAlignHorizontalRight,
  mdiAlignVerticalTop,
  mdiAlignVerticalCenter,
  mdiAlignVerticalBottom,
} from '@mdi/js'

export type AlignDirection =
  | 'left'
  | 'center-h'
  | 'right'
  | 'top'
  | 'middle-v'
  | 'bottom'

interface AlignPanelProps {
  onAlign: (direction: AlignDirection) => void
}

interface AlignEntry {
  id: AlignDirection
  title: string
  icon: string
}

const ENTRIES: AlignEntry[] = [
  { id: 'left', title: 'Align left edges', icon: mdiAlignHorizontalLeft },
  { id: 'center-h', title: 'Align horizontal centers', icon: mdiAlignHorizontalCenter },
  { id: 'right', title: 'Align right edges', icon: mdiAlignHorizontalRight },
  { id: 'top', title: 'Align top edges', icon: mdiAlignVerticalTop },
  { id: 'middle-v', title: 'Align vertical middles', icon: mdiAlignVerticalCenter },
  { id: 'bottom', title: 'Align bottom edges', icon: mdiAlignVerticalBottom },
]

export function AlignPanel({ onAlign }: AlignPanelProps) {
  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Align</p>
      <div className="grid grid-cols-3 gap-1">
        {ENTRIES.map((e) => (
          <button
            key={e.id}
            type="button"
            title={e.title}
            onClick={() => onAlign(e.id)}
            className="px-1.5 py-1.5 rounded border border-white/20 text-xs text-gray-300 hover:border-accent hover:bg-accent/20 hover:text-white transition-colors flex items-center justify-center"
          >
            <Icon path={e.icon} size={0.8} />
          </button>
        ))}
      </div>
    </div>
  )
}
