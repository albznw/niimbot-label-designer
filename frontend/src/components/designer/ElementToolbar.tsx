import { useState } from 'react'
import type { LabelCanvasHandle } from './LabelCanvas'
import { Button } from '../ui/Button'

interface ElementToolbarProps {
  canvasRef: React.RefObject<LabelCanvasHandle | null>
  hasSelection: boolean
}

export function ElementToolbar({ canvasRef, hasSelection }: ElementToolbarProps) {
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-[#2a2a2a] shrink-0">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => run(() => canvasRef.current?.addText())}
        title="Add text"
      >
        T Text
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => run(() => canvasRef.current?.addRect())}
        title="Add rectangle"
      >
        ▭ Rect
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          const content = window.prompt('QR code content', '{{url}}')
          if (content == null) return
          run(() => canvasRef.current?.addQR(content) ?? Promise.resolve())
        }}
        title="Add QR code"
      >
        ⬛ QR
      </Button>

      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => {
          const content = window.prompt('Barcode content', '{{barcode}}')
          if (content == null) return
          run(() => canvasRef.current?.addBarcode(content) ?? Promise.resolve())
        }}
        title="Add barcode"
      >
        ▦ Barcode
      </Button>

      <div className="w-px h-5 bg-white/10 mx-1" />

      <Button
        variant="danger"
        size="sm"
        disabled={!hasSelection || busy}
        onClick={() => canvasRef.current?.deleteSelected()}
        title="Delete selected element"
      >
        🗑 Delete
      </Button>
    </div>
  )
}
