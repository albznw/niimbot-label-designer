import { useState } from 'react'
import type { Template } from '../../types/project'
import type { PrinterStatus, PrintOptions } from '../../lib/printer-client'
import { BitmapPreview } from '../designer/BitmapPreview'

interface PrintDialogProps {
  template: Template
  currentBitmap: Uint8Array | null
  bitmapWidth: number
  bitmapHeight: number
  printerStatus: PrinterStatus
  onPrint: (variableValues: Record<string, string>, options: PrintOptions) => Promise<void>
  onClose: () => void
}

export function PrintDialog({
  template,
  currentBitmap,
  bitmapWidth,
  bitmapHeight,
  printerStatus,
  onPrint,
  onClose,
}: PrintDialogProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>(
    () => Object.fromEntries(template.variables.map((v) => [v.name, v.default]))
  )
  const [density, setDensity] = useState(3)
  const [quantity, setQuantity] = useState(1)
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const canPrint = printerStatus.connected && currentBitmap !== null && !printing

  const handlePrint = async () => {
    setPrintError(null)
    setPrinting(true)
    try {
      await onPrint(variableValues, { density, quantity })
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Print failed')
    } finally {
      setPrinting(false)
    }
  }

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

          {/* Bitmap preview */}
          <div className="flex flex-col gap-1">
            <BitmapPreview
              bitmap={currentBitmap}
              width={bitmapWidth}
              height={bitmapHeight}
              labelSize={template.label_size}
            />
            <p className="text-xs text-gray-500 text-center">This is exactly what will be printed</p>
          </div>

          {/* Variables */}
          {template.variables.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Variables</span>
              {template.variables.map((v) => (
                <div key={v.name} className="flex items-center gap-3">
                  <label className="text-xs text-gray-300 w-24 shrink-0">{v.name}</label>
                  <input
                    type="text"
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

          {/* Print options */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Options</span>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-300 w-24 shrink-0">Density ({density})</label>
              <input
                type="range"
                min={1}
                max={5}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-300 w-24 shrink-0">Quantity</label>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.min(99, Math.max(1, Number(e.target.value))))}
                className="w-20 bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
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
            {printing ? 'Printing...' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  )
}
