import type { ReactNode } from 'react'
import Icon from '@mdi/react'
import {
  mdiCursorDefault,
  mdiFormatText,
  mdiRectangleOutline,
  mdiCircleOutline,
  mdiVectorLine,
  mdiQrcode,
  mdiBarcode,
  mdiImageOutline,
  mdiTrashCanOutline,
} from '@mdi/js'

export type Tool = 'select' | 'text' | 'rect' | 'circle' | 'line' | 'qr' | 'barcode' | 'image'

export interface ToolSidebarProps {
  activeTool: Tool
  onToolChange: (t: Tool) => void
  hasSelection: boolean
  onDelete: () => void
}

interface ToolEntry {
  id: Tool
  label: string
  title: string
  icon: ReactNode
}

const TOOLS: ToolEntry[] = [
  { id: 'select', label: 'Select', title: 'Select (V)', icon: <Icon path={mdiCursorDefault} size={0.8} /> },
  { id: 'text', label: 'Text', title: 'Text (T)', icon: <Icon path={mdiFormatText} size={0.8} /> },
  { id: 'rect', label: 'Rectangle', title: 'Rectangle (R)', icon: <Icon path={mdiRectangleOutline} size={0.8} /> },
  { id: 'circle', label: 'Circle', title: 'Circle (C)', icon: <Icon path={mdiCircleOutline} size={0.8} /> },
  { id: 'line', label: 'Line', title: 'Line (L)', icon: <Icon path={mdiVectorLine} size={0.8} /> },
  { id: 'qr', label: 'QR', title: 'QR Code (Q)', icon: <Icon path={mdiQrcode} size={0.8} /> },
  { id: 'barcode', label: 'Barcode', title: 'Barcode (B)', icon: <Icon path={mdiBarcode} size={0.8} /> },
  { id: 'image', label: 'Image', title: 'Image (I)', icon: <Icon path={mdiImageOutline} size={0.8} /> },
]

export function ToolSidebar({ activeTool, onToolChange, hasSelection, onDelete }: ToolSidebarProps) {
  return (
    <div className="w-12 shrink-0 flex flex-col items-center gap-1 py-2 bg-[#2a2a2a] border-r border-white/10">
      {TOOLS.map((tool) => {
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            type="button"
            title={tool.title}
            aria-label={tool.label}
            onClick={() => onToolChange(tool.id)}
            className={`w-9 h-9 flex items-center justify-center rounded border transition-colors ${
              isActive
                ? 'border-accent bg-accent/20 text-white'
                : 'border-transparent text-gray-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {tool.icon}
          </button>
        )
      })}

      <div className="h-px w-6 bg-white/10 my-1" />

      <button
        type="button"
        title="Delete selected (Del)"
        aria-label="Delete"
        disabled={!hasSelection}
        onClick={onDelete}
        className={`w-9 h-9 flex items-center justify-center rounded border transition-colors ${
          hasSelection
            ? 'border-red-600/60 bg-red-600/20 text-red-300 hover:bg-red-600/40 hover:text-white'
            : 'border-transparent text-gray-600 cursor-not-allowed'
        }`}
      >
        <Icon path={mdiTrashCanOutline} size={0.8} />
      </button>
    </div>
  )
}
