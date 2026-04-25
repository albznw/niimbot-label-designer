import { useEffect, useRef, useState, useCallback } from 'react'
import type { LabelProfile, LabelDisplayOrientation, LabelCornerStyle } from '../../types/label'
import { getCanvasDims, getEffectivePrintDirection } from '../../types/label'
import { bitmapToImageData } from '../../lib/label-renderer'

interface BitmapPreviewProps {
  bitmap: Uint8Array | null
  width: number
  height: number
  labelProfile: LabelProfile
  displayOrientation?: LabelDisplayOrientation
  printCount?: number
  activePrintRow?: number
  cornerStyle?: LabelCornerStyle
}

const MAX_W = 240
const MAX_H = 300

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | number[],
) {
  const r = typeof radii === 'number' ? [radii, radii, radii, radii] : radii
  // r = [TL, TR, BR, BL]
  ctx.moveTo(x + r[0], y)
  ctx.lineTo(x + w - r[1], y)
  ctx.arcTo(x + w, y, x + w, y + r[1], r[1])
  ctx.lineTo(x + w, y + h - r[2])
  ctx.arcTo(x + w, y + h, x + w - r[2], y + h, r[2])
  ctx.lineTo(x + r[3], y + h)
  ctx.arcTo(x, y + h, x, y + h - r[3], r[3])
  ctx.lineTo(x, y + r[0])
  ctx.arcTo(x, y, x + r[0], y, r[0])
  ctx.closePath()
}

function drawLabelPath(
  ctx: CanvasRenderingContext2D,
  labelProfile: LabelProfile,
  effDir: 'top' | 'left',
  displayW: number,
  displayH: number,
  r: number,
) {
  if (labelProfile.type === 'simple') {
    roundedRect(ctx, 0, 0, displayW, displayH, r)
  } else if (labelProfile.type === 'double') {
    if (effDir === 'top') {
      roundedRect(ctx, 0, 0, displayW, displayH / 2, r)
      roundedRect(ctx, 0, displayH / 2, displayW, displayH / 2, r)
    } else {
      roundedRect(ctx, 0, 0, displayW / 2, displayH, r)
      roundedRect(ctx, displayW / 2, 0, displayW / 2, displayH, r)
    }
  } else if (labelProfile.type === 'cable') {
    if (effDir === 'left') {
      const tailH = Math.round(displayH * 8 / 30)
      const tailY = Math.round(displayH / 4 - tailH / 2)
      roundedRect(ctx, 0, 0, displayW / 2, displayH / 2, r)
      roundedRect(ctx, 0, displayH / 2, displayW / 2, displayH / 2, r)
      roundedRect(ctx, displayW / 2, tailY, displayW / 2, tailH, [0, r, r, 0])
    } else {
      // write area: bottom half, full width
      roundedRect(ctx, 0, displayH / 2, displayW, displayH / 2, [0, 0, r, r])
      // tail area: top half, left half
      roundedRect(ctx, 0, 0, displayW / 2, displayH / 2, [r, 0, 0, r])
    }
  }
}

function drawBitmap(
  canvas: HTMLCanvasElement,
  bitmap: Uint8Array,
  width: number,
  height: number,
  displayW: number,
  displayH: number,
  labelProfile: LabelProfile,
  orientation: LabelDisplayOrientation,
  cornerStyle: LabelCornerStyle,
) {
  const ctx = canvas.getContext('2d')!
  const imageData = bitmapToImageData(bitmap, width, height)

  const effDir = getEffectivePrintDirection(labelProfile, orientation)
  const dims = getCanvasDims(labelProfile, orientation)
  const scale = displayW / dims.w
  const r = cornerStyle === 'rounded' ? Math.round(12 * scale) : 0

  // Step 1 - clear to transparent
  ctx.clearRect(0, 0, displayW, displayH)

  // Step 2 - draw label background shapes (white fill)
  ctx.save()
  ctx.fillStyle = 'white'
  ctx.beginPath()
  drawLabelPath(ctx, labelProfile, effDir, displayW, displayH, r)
  ctx.fill()
  ctx.restore()

  // Step 3 - draw items bitmap, clipped to label shapes
  const tmp = document.createElement('canvas')
  tmp.width = width
  tmp.height = height
  tmp.getContext('2d')!.putImageData(imageData, 0, 0)

  ctx.save()
  ctx.beginPath()
  drawLabelPath(ctx, labelProfile, effDir, displayW, displayH, r)
  ctx.clip()
  ctx.drawImage(tmp, 0, 0, displayW, displayH)
  ctx.restore()

  // Step 4 - overlay lines (dividers + print direction indicator)
  if (labelProfile.type === 'double') {
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    if (effDir === 'top') {
      ctx.moveTo(0, Math.round(displayH / 2))
      ctx.lineTo(displayW, Math.round(displayH / 2))
    } else {
      ctx.moveTo(Math.round(displayW / 2), 0)
      ctx.lineTo(Math.round(displayW / 2), displayH)
    }
    ctx.stroke()
    ctx.restore()
  }

  if (labelProfile.type === 'cable' && effDir === 'left') {
    const tailH = Math.round(displayH * 8 / 30)
    const tailY = Math.round(displayH / 4 - tailH / 2)
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.75)'
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 1
    // horizontal divider between top/bottom labels (left side only)
    ctx.beginPath()
    ctx.moveTo(0, Math.round(displayH / 2))
    ctx.lineTo(Math.round(displayW / 2), Math.round(displayH / 2))
    ctx.stroke()
    // tail top boundary
    ctx.beginPath()
    ctx.moveTo(Math.round(displayW / 2), tailY)
    ctx.lineTo(displayW, tailY)
    ctx.stroke()
    // tail bottom boundary
    ctx.beginPath()
    ctx.moveTo(Math.round(displayW / 2), tailY + tailH)
    ctx.lineTo(displayW, tailY + tailH)
    ctx.stroke()
    ctx.restore()
  }

  const effPrintDir = getEffectivePrintDirection(labelProfile, orientation)
  ctx.save()
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
  ctx.lineWidth = 3
  ctx.setLineDash([])
  ctx.beginPath()
  if (effPrintDir === 'left') {
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
  labelProfile,
  displayOrientation = 'landscape',
  printCount = 1,
  activePrintRow = 0,
  cornerStyle = 'rect',
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
      drawBitmap(canvasRef.current, bitmap, width, height, displayW, displayH, labelProfile, displayOrientation, cornerStyle)
    }
  }, [bitmap, width, height, displayW, displayH, labelProfile, displayOrientation, cornerStyle])

  useEffect(() => {
    if (expanded && modalCanvasRef.current && bitmap) {
      drawBitmap(modalCanvasRef.current, bitmap, width, height, modalW, modalH, labelProfile, displayOrientation, cornerStyle)
    }
  }, [expanded, bitmap, width, height, modalW, modalH, labelProfile, displayOrientation, cornerStyle])

  // Fix #1 - ESC closes expanded modal
  useEffect(() => {
    if (!expanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expanded])

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
            className="flex items-center justify-center bg-[#1a1a1a] border border-white/5 text-gray-600 text-xs mx-auto"
            style={{ width: displayW, height: displayH, borderRadius: 4 }}
          >
            Render a label to see preview
          </div>
        ) : (
          <div
            className="border border-white/10 cursor-zoom-in mx-auto"
            style={{ width: displayW, height: displayH, lineHeight: 0 }}
            onClick={toggle}
            title="Click to expand"
          >
            <canvas
              ref={canvasRef}
              width={displayW}
              height={displayH}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        )}

        <p className="text-xs text-gray-600">
          {width}×{height}px · B1 · 203 DPI · {labelProfile.name}
          {printCount > 1 ? ` · ${printCount} labels (row ${activePrintRow + 1})` : ' · 1 label'}
        </p>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out"
          onClick={toggle}
        >
          <div
            className="border border-white/20 shadow-2xl"
            style={{ width: modalW, height: modalH, lineHeight: 0 }}
          >
            <canvas
              ref={modalCanvasRef}
              width={modalW}
              height={modalH}
              style={{ imageRendering: 'pixelated', display: 'block' }}
            />
          </div>
        </div>
      )}
    </>
  )
}
