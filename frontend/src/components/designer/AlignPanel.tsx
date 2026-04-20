import Icon from '@mdi/react'
import {
  mdiAlignHorizontalLeft,
  mdiAlignHorizontalCenter,
  mdiAlignHorizontalRight,
  mdiAlignVerticalTop,
  mdiAlignVerticalCenter,
  mdiAlignVerticalBottom,
  mdiDistributeHorizontalCenter,
  mdiDistributeVerticalCenter,
} from '@mdi/js'

export type AlignDirection = 'left' | 'center-h' | 'right' | 'top' | 'middle-v' | 'bottom'
export type DistributeDirection = 'horizontal' | 'vertical'

interface AlignPanelProps {
  onAlign: (direction: AlignDirection) => void
  onDistribute: (direction: DistributeDirection) => void
}

const ALIGN_ENTRIES = [
  { id: 'left' as AlignDirection, title: 'Align left edges', icon: mdiAlignHorizontalLeft },
  { id: 'center-h' as AlignDirection, title: 'Align horizontal centers', icon: mdiAlignHorizontalCenter },
  { id: 'right' as AlignDirection, title: 'Align right edges', icon: mdiAlignHorizontalRight },
  { id: 'top' as AlignDirection, title: 'Align top edges', icon: mdiAlignVerticalTop },
  { id: 'middle-v' as AlignDirection, title: 'Align vertical middles', icon: mdiAlignVerticalCenter },
  { id: 'bottom' as AlignDirection, title: 'Align bottom edges', icon: mdiAlignVerticalBottom },
]

const DISTRIBUTE_ENTRIES = [
  { id: 'horizontal' as DistributeDirection, title: 'Distribute horizontally', icon: mdiDistributeHorizontalCenter },
  { id: 'vertical' as DistributeDirection, title: 'Distribute vertically', icon: mdiDistributeVerticalCenter },
]

export function AlignPanel({ onAlign, onDistribute }: AlignPanelProps) {
  return (
    <div className="flex flex-col gap-2 px-4 pt-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Align</p>
      <div className="grid grid-cols-3 gap-1">
        {ALIGN_ENTRIES.map((e) => (
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
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">Distribute</p>
      <div className="grid grid-cols-2 gap-1">
        {DISTRIBUTE_ENTRIES.map((e) => (
          <button
            key={e.id}
            type="button"
            title={e.title}
            onClick={() => onDistribute(e.id)}
            className="px-1.5 py-1.5 rounded border border-white/20 text-xs text-gray-300 hover:border-accent hover:bg-accent/20 hover:text-white transition-colors flex items-center justify-center"
          >
            <Icon path={e.icon} size={0.8} />
          </button>
        ))}
      </div>
    </div>
  )
}
