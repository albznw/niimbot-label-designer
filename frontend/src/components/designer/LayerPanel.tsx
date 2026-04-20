import { useState, useRef } from 'react'
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
  mdiDragVertical,
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
    case 'qr':
      return mdiQrcode
    case 'barcode':
      return mdiBarcode
    case 'image':
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
  if (node.type === 'qr') return 'QR code'
  if (node.type === 'barcode') return 'Barcode'
  if (node.type === 'image') return 'Image'
  if (node.type === 'rect') return 'Rectangle'
  if (node.type === 'circle') return 'Circle'
  if (node.type === 'line') return 'Line'
  return 'Element'
}

export function LayerPanel({
  nodes,
  selectedIds,
  onSelect,
  onReorder,
  onMoveForward,
  onMoveBackward,
}: LayerPanelProps) {
  // Display in reverse order (last painted = topmost = first in list)
  const displayed = [...nodes].reverse()

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ index: number; position: 'top' | 'bottom' } | null>(null)
  const dragCounter = useRef(0)

  function handleDragStart(index: number) {
    setDraggedIndex(index)
    dragCounter.current = 0
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: 'top' | 'bottom' = e.clientY < midY ? 'top' : 'bottom'
    setDropIndicator({ index, position })
  }

  function handleDragLeave() {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDropIndicator(null)
    }
  }

  function handleDragEnter() {
    dragCounter.current++
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    if (draggedIndex === null) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: 'top' | 'bottom' = e.clientY < midY ? 'top' : 'bottom'

    let toIndex = position === 'top' ? targetIndex : targetIndex + 1
    // Adjust for the removal of the dragged item
    if (draggedIndex < toIndex) toIndex--

    if (toIndex !== draggedIndex) {
      onReorder(draggedIndex, toIndex)
    }

    setDraggedIndex(null)
    setDropIndicator(null)
    dragCounter.current = 0
  }

  function handleDragEnd() {
    setDraggedIndex(null)
    setDropIndicator(null)
    dragCounter.current = 0
  }

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-white/10">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Layers</p>
      {displayed.length === 0 ? (
        <p className="text-xs text-gray-500">No elements yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {displayed.map((node, index) => {
            const isSelected = selectedIds.includes(node.id)
            const isDragging = draggedIndex === index
            const indicator = dropIndicator?.index === index ? dropIndicator.position : null

            return (
              <div
                key={node.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors select-none
                  ${isSelected
                    ? 'border-accent bg-accent/20 text-white'
                    : 'border-white/10 bg-[#1a1a1a] text-gray-300 hover:border-white/30'
                  }
                  ${isDragging ? 'opacity-40' : ''}
                  ${indicator === 'top' ? 'border-t-2 border-t-blue-400' : ''}
                  ${indicator === 'bottom' ? 'border-b-2 border-b-blue-400' : ''}
                `}
                onClick={() => onSelect(node.id)}
              >
                <span className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0">
                  <Icon path={mdiDragVertical} size={0.6} />
                </span>
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
