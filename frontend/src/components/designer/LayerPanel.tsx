import Icon from '@mdi/react'
import {
  mdiFormatText,
  mdiRectangleOutline,
  mdiCircleOutline,
  mdiVectorLine,
  mdiImage,
  mdiQrcode,
  mdiBarcode,
  mdiChevronUp,
  mdiChevronDown,
} from '@mdi/js'
import type { NodeConfig } from './LabelCanvas'

interface LayerPanelProps {
  nodes: NodeConfig[]
  selectedIds: string[]
  onSelect: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onMoveToFront: (id: string) => void
  onMoveToBack: (id: string) => void
  onMoveForward: (id: string) => void
  onMoveBackward: (id: string) => void
}

function iconForNode(node: NodeConfig): string {
  switch (node.type) {
    case 'text':
      return mdiFormatText
    case 'rect':
      return mdiRectangleOutline
    case 'circle':
      return mdiCircleOutline
    case 'line':
      return mdiVectorLine
    case 'image':
      if (node.id.startsWith('qr')) return mdiQrcode
      if (node.id.startsWith('barcode')) return mdiBarcode
      return mdiImage
    default:
      return mdiImage
  }
}

function labelForNode(node: NodeConfig): string {
  if (node.type === 'text') {
    const t = (node.text ?? '').trim()
    if (t.length === 0) return 'Text'
    return t.length > 20 ? `${t.slice(0, 20)}…` : t
  }
  if (node.type === 'image') {
    if (node.id.startsWith('qr')) return 'QR code'
    if (node.id.startsWith('barcode')) return 'Barcode'
    return 'Image'
  }
  if (node.type === 'rect') return 'Rectangle'
  if (node.type === 'circle') return 'Circle'
  if (node.type === 'line') return 'Line'
  return 'Element'
}

export function LayerPanel({
  nodes,
  selectedIds,
  onSelect,
  onMoveForward,
  onMoveBackward,
}: LayerPanelProps) {
  // Display in reverse order (last painted = topmost = first in list)
  const displayed = [...nodes].reverse()

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-white/10">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</p>
      {displayed.length === 0 ? (
        <p className="text-xs text-gray-500">No elements yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {displayed.map((node) => {
            const isSelected = selectedIds.includes(node.id)
            return (
              <div
                key={node.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent/20 text-white'
                    : 'border-white/10 bg-[#1a1a1a] text-gray-300 hover:border-white/30'
                }`}
                onClick={() => onSelect(node.id)}
              >
                <Icon path={iconForNode(node)} size={0.6} />
                <span className="text-xs flex-1 truncate">{labelForNode(node)}</span>
                <button
                  type="button"
                  title="Move forward"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveForward(node.id)
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <Icon path={mdiChevronUp} size={0.6} />
                </button>
                <button
                  type="button"
                  title="Move backward"
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveBackward(node.id)
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <Icon path={mdiChevronDown} size={0.6} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
