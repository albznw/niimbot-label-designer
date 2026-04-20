import { useEffect, useRef, useState, useCallback } from 'react'
import type { LabelOrientation, LabelSize } from '../../types/label'
import { bitmapToImageData } from '../../lib/label-renderer'

interface BitmapPreviewProps {
  bitmap: Uint8Array | null
  width: number
  height: number
  labelSize: LabelSize
  orientation?: LabelOrientation
  printCount?: number
  activePrintRow?: number
}

const MAX_W = 400
const MAX_H = 300

function drawBitmap(
  canvas: HTMLCanvasElement,
  bitmap: Uint8Array,
  width: number,
  height: number,
  displayW: number,
  displayH: number,
  labelSize: LabelSize,
  orientation: LabelOrientation,
) {
  const ctx = canvas.getContext('2d')!
  const imageData = bitmapToImageData(bitmap, width, height)
  const tmp = document.createElement('canvas')
  tmp.width = width
  tmp.height = height
  tmp.getContext('2d')!.putImageData(imageData, 0, 0)
  ctx.clearRect(0, 0, displayW, displayH)
  ctx.drawImage(tmp, 0, 0, displayW, displayH)

  if (labelSize === '30x30') {
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, Math.round(displayH / 2))
    ctx.lineTo(displayW, Math.round(displayH / 2))
    ctx.stroke()
    ctx.restore()
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
  ctx.lineWidth = 3
  ctx.setLineDash([])
  ctx.beginPath()
  if (orientation === 'portrait') {
    ctx.moveTo(1.5, 0)
    ctx.lineTo(1.5, displayH)
  } else {
    ctx.moveTo(0, 1.5)
    ctx.lineTo(displayW, 1.5)
  }
  ctx.stroke()
  ctx.restore()
}

export function BitmapPreview({
  bitmap,
  width,
  height,
  labelSize,
  orientation = 'landscape',
  printCount = 1,
  activePrintRow = 0,
}: BitmapPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modalCanvasRef = useRef<HTMLCanvasElement>(null)
  const [expanded, setExpanded] = useState(false)

  const scale = Math.min(MAX_W / width, MAX_H / height, 1)
  const displayW = Math.round(width * scale)
  const displayH = Math.round(height * scale)

  // Modal scale: fit within 90% of viewport
  const modalScale = Math.min((window.innerWidth * 0.85) / width, (window.innerHeight * 0.85) / height, 4)
  const modalW = Math.round(width * modalScale)
  const modalH = Math.round(height * modalScale)

  useEffect(() => {
    if (canvasRef.current && bitmap) {
      drawBitmap(canvasRef.current, bitmap, width, height, displayW, displayH, labelSize, orientation)
    }
  }, [bitmap, width, height, displayW, displayH, labelSize, orientation])

  useEffect(() => {
    if (expanded && modalCanvasRef.current && bitmap) {
      drawBitmap(modalCanvasRef.current, bitmap, width, height, modalW, modalH, labelSize, orientation)
    }
  }, [expanded, bitmap, width, height, modalW, modalH, labelSize, orientation])

  const toggle = useCallback(() => setExpanded((v) => !v), [])

  return (
    <>
      <div className="flex flex-col gap-2 p-4 bg-[#2a2a2a] border-t border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bitmap Preview</span>
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
            className="rounded border border-white/10 cursor-zoom-in"
            style={{ imageRendering: 'pixelated' }}
            onClick={toggle}
            title="Click to expand"
          />
        )}

        <p className="text-xs text-gray-600">
          {width}×{height}px · B1 · 203 DPI · {labelSize}mm
          {printCount > 1 ? ` · ${printCount} labels (row ${activePrintRow + 1})` : ' · 1 label'}
        </p>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out"
          onClick={toggle}
        >
          <canvas
            ref={modalCanvasRef}
            width={modalW}
            height={modalH}
            className="rounded border border-white/20 shadow-2xl"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </>
  )
}
