import { useEffect, useRef } from 'react'
import type { LabelSize } from '../../types/label'
import { bitmapToImageData } from '../../lib/label-renderer'

interface BitmapPreviewProps {
  bitmap: Uint8Array | null
  width: number
  height: number
  labelSize: LabelSize
}

const MAX_W = 400
const MAX_H = 300

export function BitmapPreview({ bitmap, width, height, labelSize }: BitmapPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const scale = Math.min(MAX_W / width, MAX_H / height, 1)
  const displayW = Math.round(width * scale)
  const displayH = Math.round(height * scale)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bitmap) return
    const ctx = canvas.getContext('2d')!
    const imageData = bitmapToImageData(bitmap, width, height)

    // Draw at native resolution into a temp canvas then scale
    const tmp = document.createElement('canvas')
    tmp.width = width
    tmp.height = height
    tmp.getContext('2d')!.putImageData(imageData, 0, 0)
    ctx.clearRect(0, 0, displayW, displayH)
    ctx.drawImage(tmp, 0, 0, displayW, displayH)
  }, [bitmap, width, height, displayW, displayH])

  return (
    <div className="flex flex-col gap-2 p-4 bg-[#2a2a2a] border-t border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Bitmap Preview
        </span>
        <span className="text-xs text-gray-600">Exact output sent to printer</span>
      </div>

      {!bitmap ? (
        <div
          className="flex items-center justify-center bg-[#1a1a1a] rounded border border-white/5 text-gray-600 text-xs"
          style={{ width: displayW, height: displayH }}
        >
          Render a label to see preview
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={displayW}
          height={displayH}
          className="rounded border border-white/10"
          style={{ imageRendering: 'pixelated' }}
        />
      )}

      <p className="text-xs text-gray-600">
        {width}×{height}px · B1 · 203 DPI · {labelSize}mm
      </p>
    </div>
  )
}
