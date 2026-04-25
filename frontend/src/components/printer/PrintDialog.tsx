import { useState, useEffect, useRef, useCallback } from 'react'
import type { Template } from '../../types/project'
import type { PrinterStatus, PrintOptions } from '../../lib/printer-client'
import type { LabelProfile } from '../../types/label'
import { getEffectivePrintDirection } from '../../types/label'
import { bitmapToImageData } from '../../lib/label-renderer'

interface PrintDialogProps {
  template: Template
  currentBitmap: Uint8Array | null
  bitmapWidth: number
  bitmapHeight: number
  printerStatus: PrinterStatus
  labelProfile: LabelProfile
  printRows?: Record<string, string>[]
  onPrint: (variableValues: Record<string, string>, options: PrintOptions) => Promise<void>
  onBatchPrint?: (rows: Record<string, string>[], options: PrintOptions) => Promise<void>
  onRenderRow?: (vars: Record<string, string>) => Promise<{ bitmap: Uint8Array; w: number; h: number }>
  onClose: () => void
}

export function PrintDialog({
  template,
  currentBitmap,
  bitmapWidth,
  bitmapHeight,
  printerStatus,
  labelProfile,
  printRows,
  onPrint,
  onBatchPrint,
  onRenderRow,
  onClose,
}: PrintDialogProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    () => Object.fromEntries(template.variables.map((v) => [v.name, v.default]))
  )
  const [density, setDensity] = useState(template.density)
  const [quantity, setQuantity] = useState(1)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [printHalf, setPrintHalf] = useState<'both' | 'top' | 'bottom'>('both')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modalCanvasRef = useRef<HTMLCanvasElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [displayDims, setDisplayDims] = useState({ w: 0, h: 0 })
  const toggle = useCallback(() => setExpanded((v) => !v), [])

  const isBatchMode = printRows !== undefined && printRows.length > 0

  // Batch mode state
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(
    () => new Set((printRows ?? []).map((_, i) => i))
  )
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [carouselBitmaps, setCarouselBitmaps] = useState<Map<number, { bitmap: Uint8Array; w: number; h: number }>>(new Map())
  const [carouselLoading, setCarouselLoading] = useState(false)
  const carouselCanvasRef = useRef<HTMLCanvasElement>(null)

  function drawOnCanvas(
    canvas: HTMLCanvasElement,
    maxW: number,
    maxH: number,
    override?: { bitmap: Uint8Array; w: number; h: number }
  ) {
    const bmp = override?.bitmap ?? currentBitmap
    const bw = override?.w ?? bitmapWidth
    const bh = override?.h ?? bitmapHeight
    if (!bmp || bw <= 0 || bh <= 0) return
    const scale = Math.min(maxW / bw, maxH / bh, 4)
    const dw = Math.round(bw * scale)
    const dh = Math.round(bh * scale)
    canvas.width = bw
    canvas.height = bh
    canvas.style.width = `${dw}px`
    canvas.style.height = `${dh}px`
    const imageData = bitmapToImageData(bmp, bw, bh)
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(imageData, 0, 0)
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)'
    ctx.lineWidth = Math.max(1, Math.round(3 / scale))
    ctx.setLineDash([])
    ctx.beginPath()
    const effDir = getEffectivePrintDirection(labelProfile, template.display_orientation)
    if (effDir === 'left') {
      ctx.moveTo(1, 0); ctx.lineTo(1, bh)
    } else {
      ctx.moveTo(0, 1); ctx.lineTo(bw, 1)
    }
    ctx.stroke()
    ctx.restore()
    return { dw, dh }
  }

  useEffect(() => {
    if (!isBatchMode && canvasRef.current) {
      const dims = drawOnCanvas(canvasRef.current, 440, 280)
      if (dims) setDisplayDims({ w: dims.dw, h: dims.dh })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBitmap, bitmapWidth, bitmapHeight, isBatchMode])

  useEffect(() => {
    if (!isBatchMode && expanded && modalCanvasRef.current) {
      drawOnCanvas(modalCanvasRef.current, window.innerWidth * 0.85, window.innerHeight * 0.85)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, currentBitmap, bitmapWidth, bitmapHeight, isBatchMode])

  // Carousel: fetch bitmap for current index if not cached
  useEffect(() => {
    if (!isBatchMode || !onRenderRow || !printRows) return
    if (carouselBitmaps.has(carouselIndex)) return
    setCarouselLoading(true)
    onRenderRow(printRows[carouselIndex]).then((result) => {
      setCarouselBitmaps((prev) => new Map(prev).set(carouselIndex, result))
      setCarouselLoading(false)
    }).catch(() => setCarouselLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselIndex, isBatchMode])

  // Draw carousel bitmap onto canvas
  useEffect(() => {
    if (!isBatchMode || !carouselCanvasRef.current) return
    const entry = carouselBitmaps.get(carouselIndex)
    if (!entry) return
    const dims = drawOnCanvas(carouselCanvasRef.current, 440, 280, entry)
    if (dims) setDisplayDims({ w: dims.dw, h: dims.dh })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselBitmaps, carouselIndex, isBatchMode])

  // Expanded modal: carousel bitmap
  useEffect(() => {
    if (!isBatchMode || !expanded || !modalCanvasRef.current) return
    const entry = carouselBitmaps.get(carouselIndex)
    if (!entry) return
    drawOnCanvas(modalCanvasRef.current, window.innerWidth * 0.85, window.innerHeight * 0.85, entry)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, carouselBitmaps, carouselIndex, isBatchMode])

  const selectedRows = (printRows ?? []).filter((_, i) => selectedRowIndices.has(i))
  const canPrint = printerStatus.connected && (isBatchMode ? selectedRows.length > 0 : currentBitmap !== null) && !printing

  const handlePrint = async () => {
    setPrintError(null)
    setPrinting(true)
    try {
      if (isBatchMode && onBatchPrint) {
        await onBatchPrint(selectedRows, {
          density,
          quantity: 1,
          labelType: labelProfile.labelType,
          printHalf,
          printDirection: getEffectivePrintDirection(labelProfile, template.display_orientation),
        })
      } else {
        await onPrint(variableValues, {
          density,
          quantity,
          labelType: labelProfile.labelType,
          printHalf,
          printDirection: getEffectivePrintDirection(labelProfile, template.display_orientation),
        })
      }
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Print failed')
    } finally {
      setPrinting(false)
    }
  }

  const toggleRow = (i: number) => {
    setSelectedRowIndices((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const selectAll = () => setSelectedRowIndices(new Set((printRows ?? []).map((_, i) => i)))
  const selectNone = () => setSelectedRowIndices(new Set())

  const carouselEntry = carouselBitmaps.get(carouselIndex)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#2a2a2a] border border-white/10 rounded-lg w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold">Print - {template.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Printer status */}
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${printerStatus.connected ? 'bg-green-400' : 'bg-gray-500'}`} />
            {printerStatus.connected
              ? <span className="text-green-300">Connected to: {printerStatus.deviceName}</span>
              : <span className="text-gray-400">No printer connected</span>}
          </div>

          {isBatchMode ? (
            <>
              {/* Carousel section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <button
                    onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                    disabled={carouselIndex === 0}
                    className="px-2 py-0.5 bg-[#1a1a1a] border border-white/10 rounded disabled:opacity-30 hover:bg-[#242424] disabled:cursor-not-allowed"
                  >
                    ←
                  </button>
                  <span>Row {carouselIndex + 1} / {printRows.length}</span>
                  <button
                    onClick={() => setCarouselIndex((i) => Math.min(printRows.length - 1, i + 1))}
                    disabled={carouselIndex === printRows.length - 1}
                    className="px-2 py-0.5 bg-[#1a1a1a] border border-white/10 rounded disabled:opacity-30 hover:bg-[#242424] disabled:cursor-not-allowed"
                  >
                    →
                  </button>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="relative border border-white/10 cursor-zoom-in"
                    style={{
                      lineHeight: 0,
                      borderRadius: template.corner_style === 'rounded' ? Math.round(12 * (displayDims.w / ((carouselEntry?.w ?? bitmapWidth) || 1))) : 4,
                      overflow: 'hidden',
                      minWidth: 80,
                      minHeight: 40,
                    }}
                    onClick={toggle}
                    title="Click to expand"
                  >
                    <canvas ref={carouselCanvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />
                    {carouselLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-gray-300">
                        Rendering...
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">Click to expand</p>
                </div>
              </div>

              {/* Row selection section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-400 uppercase tracking-wider">
                    Rows ({selectedRowIndices.size} of {printRows.length} selected)
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={selectAll}
                      className="px-2 py-0.5 bg-[#1a1a1a] border border-white/10 rounded hover:bg-[#242424] text-gray-300"
                    >
                      All
                    </button>
                    <button
                      onClick={selectNone}
                      className="px-2 py-0.5 bg-[#1a1a1a] border border-white/10 rounded hover:bg-[#242424] text-gray-300"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto border border-white/10 rounded bg-[#1a1a1a]">
                  {printRows.map((row, i) => {
                    const summary = Object.entries(row)
                      .map(([k, v]) => `${k}=${v.length > 20 ? v.slice(0, 20) + '…' : v}`)
                      .join(', ')
                    return (
                      <label
                        key={i}
                        className={`flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-white/5 text-xs ${
                          i === carouselIndex ? 'bg-white/5' : ''
                        }`}
                        onClick={() => setCarouselIndex(i)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRowIndices.has(i)}
                          onChange={() => toggleRow(i)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <span className="text-gray-400 shrink-0">Row {i + 1}:</span>
                        <span className="text-gray-300 truncate">{summary}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Bitmap preview - single mode */}
              <div className="flex flex-col gap-1 items-center">
                {currentBitmap ? (
                  <div
                    className="border border-white/10 cursor-zoom-in"
                    style={{
                      lineHeight: 0,
                      borderRadius: template.corner_style === 'rounded' ? Math.round(12 * (displayDims.w / bitmapWidth)) : 4,
                      overflow: 'hidden',
                    }}
                    onClick={toggle}
                    title="Click to expand"
                  >
                    <canvas ref={canvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 py-4">No preview available</div>
                )}
                <p className="text-xs text-gray-500">This is exactly what will be printed</p>
              </div>

              {/* Variables - only shown in single mode */}
              {template.variables.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variables</span>
                  {template.variables.map((v) => (
                    <div key={v.name} className="flex items-center gap-3">
                      <label className="text-xs text-gray-300 w-24 shrink-0">{v.name}</label>
                      <input
                        type="text"
                        name={v.name}
                        autoComplete="off"
                        value={variableValues[v.name] ?? ''}
                        onChange={(e) =>
                          setVariableValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        className="flex-1 bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {expanded && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-zoom-out"
              onClick={toggle}
            >
              <canvas ref={modalCanvasRef} style={{ imageRendering: 'pixelated', display: 'block' }} />
            </div>
          )}

          {/* Print options */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Options</span>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-300 w-24 shrink-0">Density ({density})</label>
              <input
                type="range"
                name="density"
                min={1}
                max={5}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            {(labelProfile.type === 'double' || labelProfile.type === 'cable') && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-24 shrink-0">Print</span>
                <div className="flex gap-1">
                  {(['both', 'top', 'bottom'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setPrintHalf(opt)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                        printHalf === opt
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
                      }`}
                    >
                      {opt === 'both' ? 'Both' : opt === 'top' ? 'Top' : 'Bottom'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {isBatchMode ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-300 w-24 shrink-0">Batch</span>
                <span className="text-xs text-blue-300">
                  {selectedRows.length} of {printRows.length} label{printRows.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-300 w-24 shrink-0">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  autoComplete="off"
                  min={1}
                  max={99}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number(e.target.value))))}
                  className="w-20 bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {printError && (
            <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">{printError}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="text-xs px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors font-medium"
          >
            {printing
              ? 'Printing...'
              : isBatchMode
                ? `Print ${selectedRows.length} label${selectedRows.length !== 1 ? 's' : ''}`
                : 'Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
