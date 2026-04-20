import { useEffect, useState, useCallback } from 'react'
import type { NodeConfig } from './LabelCanvas'

declare global {
  interface Window {
    queryLocalFonts?: () => Promise<{ family: string; fullName: string }[]>
  }
}

interface PropertiesPanelProps {
  selectedObject: NodeConfig | NodeConfig[] | null
  onUpdate: (patch: Partial<NodeConfig>) => void
}

interface ObjState {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // text
  text: string
  fontSize: number
  fontWeight: string // 'normal' | 'bold'
  fontStyle: string // 'normal' | 'italic'
  fontFamily: string
  textAlign: string
  // rect / circle / line
  fill: string
  stroke: string
  strokeWidth: number
  // circle
  radiusX: number
  radiusY: number
  // qr / barcode
  content: string
}

function parseFontStyle(style: string): { bold: boolean; italic: boolean } {
  const tokens = (style ?? '').toLowerCase().split(/\s+/)
  return {
    bold: tokens.includes('bold'),
    italic: tokens.includes('italic'),
  }
}

function composeFontStyle(bold: boolean, italic: boolean): string {
  const parts: string[] = []
  if (bold) parts.push('bold')
  if (italic) parts.push('italic')
  return parts.length === 0 ? 'normal' : parts.join(' ')
}

function readState(node: NodeConfig | null): ObjState {
  const defaults: ObjState = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    text: '',
    fontSize: 20,
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontFamily: 'Arial',
    textAlign: 'left',
    fill: '#ffffff',
    stroke: '#000000',
    strokeWidth: 1,
    radiusX: 0,
    radiusY: 0,
    content: '',
  }
  if (!node) return defaults

  const base: ObjState = {
    ...defaults,
    x: Math.round(node.x ?? 0),
    y: Math.round(node.y ?? 0),
    rotation: Math.round(node.rotation ?? 0),
  }

  if (node.type === 'text') {
    const { bold, italic } = parseFontStyle(node.fontStyle)
    return {
      ...base,
      width: Math.round(node.width ?? 0),
      height: 0,
      text: node.text ?? '',
      fontSize: node.fontSize ?? 20,
      fontWeight: bold ? 'bold' : 'normal',
      fontStyle: italic ? 'italic' : 'normal',
      fontFamily: node.fontFamily ?? 'Arial',
      textAlign: node.align ?? 'left',
      fill: node.fill ?? '#000000',
    }
  }

  if (node.type === 'rect') {
    return {
      ...base,
      width: Math.round(node.width ?? 0),
      height: Math.round(node.height ?? 0),
      fill: String(node.fill ?? '#ffffff'),
      stroke: String(node.stroke ?? '#000000'),
      strokeWidth: node.strokeWidth ?? 1,
    }
  }

  if (node.type === 'circle') {
    return {
      ...base,
      radiusX: Math.round(node.radiusX ?? 0),
      radiusY: Math.round(node.radiusY ?? 0),
      fill: String(node.fill ?? '#ffffff'),
      stroke: String(node.stroke ?? '#000000'),
      strokeWidth: node.strokeWidth ?? 1,
    }
  }

  if (node.type === 'line') {
    return {
      ...base,
      stroke: String(node.stroke ?? '#000000'),
      strokeWidth: node.strokeWidth ?? 1,
    }
  }

  if (node.type === 'qr' || node.type === 'barcode') {
    return {
      ...base,
      width: Math.round(node.width ?? 0),
      height: Math.round(node.height ?? 0),
      content: node.content ?? '',
    }
  }

  // image
  return {
    ...base,
    width: Math.round(node.width ?? 0),
    height: Math.round(node.height ?? 0),
  }
}

export function PropertiesPanel({ selectedObject, onUpdate }: PropertiesPanelProps) {
  const isArray = Array.isArray(selectedObject)
  const single = !isArray ? (selectedObject as NodeConfig | null) : null

  const [state, setState] = useState<ObjState>(readState(single))
  const [localFonts, setLocalFonts] = useState<string[] | null>(null)
  const [fontApiAvailable, setFontApiAvailable] = useState<boolean>(
    typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function'
  )
  const [fontsAttempted, setFontsAttempted] = useState(false)

  useEffect(() => {
    setState(readState(single))
  }, [single])

  useEffect(() => {
    if (fontsAttempted) return
    if (!single || single.type !== 'text') return
    if (typeof window === 'undefined' || typeof window.queryLocalFonts !== 'function') {
      setFontApiAvailable(false)
      setFontsAttempted(true)
      return
    }
    setFontsAttempted(true)
    window
      .queryLocalFonts()
      .then((fonts) => {
        const families = Array.from(new Set(fonts.map((f) => f.family))).sort((a, b) =>
          a.localeCompare(b)
        )
        setLocalFonts(families)
        setFontApiAvailable(true)
      })
      .catch(() => {
        setFontApiAvailable(false)
      })
  }, [single, fontsAttempted])

  const apply = useCallback(
    (patch: Partial<ObjState>) => {
      if (!single) return
      const next = { ...state, ...patch }
      setState(next)

      const nodePatch: Record<string, unknown> = {
        x: next.x,
        y: next.y,
        rotation: next.rotation,
      }

      if (single.type === 'text') {
        nodePatch.width = next.width
        nodePatch.text = next.text
        nodePatch.fontSize = next.fontSize
        nodePatch.fontStyle = composeFontStyle(
          next.fontWeight === 'bold',
          next.fontStyle === 'italic'
        )
        nodePatch.fontFamily = next.fontFamily
        nodePatch.align = next.textAlign
        nodePatch.fill = next.fill
      }

      if (single.type === 'rect') {
        nodePatch.width = next.width
        nodePatch.height = next.height
        nodePatch.fill = next.fill
        nodePatch.stroke = next.stroke
        nodePatch.strokeWidth = next.strokeWidth
      }

      if (single.type === 'circle') {
        nodePatch.radiusX = next.radiusX
        nodePatch.radiusY = next.radiusY
        nodePatch.fill = next.fill
        nodePatch.stroke = next.stroke
        nodePatch.strokeWidth = next.strokeWidth
      }

      if (single.type === 'line') {
        nodePatch.stroke = next.stroke
        nodePatch.strokeWidth = next.strokeWidth
      }

      if (single.type === 'image') {
        nodePatch.width = next.width
        nodePatch.height = next.height
      }

      if (single.type === 'qr' || single.type === 'barcode') {
        nodePatch.width = next.width
        nodePatch.height = next.height
        nodePatch.content = next.content
      }

      onUpdate(nodePatch as Partial<NodeConfig>)
    },
    [single, onUpdate, state]
  )

  // Nothing selected
  if (!selectedObject || (Array.isArray(selectedObject) && selectedObject.length === 0)) {
    return (
      <div className="flex items-center justify-center py-6 px-4">
        <p className="text-xs text-gray-500 text-center">Select an element to edit its properties</p>
      </div>
    )
  }

  // Multi-selection: show minimal info only
  if (Array.isArray(selectedObject)) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Properties ({selectedObject.length})
        </p>
        <p className="text-xs text-gray-500">
          {selectedObject.length} elements selected. Use the align panel above to align them.
        </p>
      </div>
    )
  }

  const node = single as NodeConfig
  const isText = node.type === 'text'
  const isRectObj = node.type === 'rect'
  const isCircle = node.type === 'circle'
  const isLine = node.type === 'line'
  const isQR = node.type === 'qr'
  const isBarcode = node.type === 'barcode'

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Properties</p>

      {isText && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Text</p>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Content</span>
            <textarea
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-accent"
              rows={3}
              value={state.text}
              onChange={(e) => apply({ text: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Font size</span>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-accent"
              value={state.fontSize}
              min={6}
              max={200}
              onChange={(e) => apply({ fontSize: Number(e.target.value) })}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Font family</span>
            {fontApiAvailable && localFonts ? (
              <select
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-accent"
                value={state.fontFamily}
                onChange={(e) => apply({ fontFamily: e.target.value })}
                style={{ fontFamily: state.fontFamily }}
              >
                {localFonts.includes(state.fontFamily) ? null : (
                  <option value={state.fontFamily} style={{ fontFamily: state.fontFamily }}>
                    {state.fontFamily}
                  </option>
                )}
                {localFonts.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-accent"
                value={state.fontFamily}
                onChange={(e) => apply({ fontFamily: e.target.value })}
                placeholder="e.g. Arial"
                style={{ fontFamily: state.fontFamily }}
              />
            )}
            <span
              className="text-[11px] text-gray-500 mt-0.5"
              style={{ fontFamily: state.fontFamily }}
            >
              Preview: {state.fontFamily}
            </span>
          </label>

          <div className="flex gap-2">
            <button
              className={`flex-1 py-1 rounded text-xs border transition-colors ${state.fontWeight === 'bold' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}
              onClick={() => apply({ fontWeight: state.fontWeight === 'bold' ? 'normal' : 'bold' })}
            >
              B Bold
            </button>
            <button
              className={`flex-1 py-1 rounded text-xs border transition-colors italic ${state.fontStyle === 'italic' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}
              onClick={() => apply({ fontStyle: state.fontStyle === 'italic' ? 'normal' : 'italic' })}
            >
              I Italic
            </button>
          </div>

          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                className={`flex-1 py-1 rounded text-xs border transition-colors ${state.textAlign === a ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}
                onClick={() => apply({ textAlign: a })}
              >
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </section>
      )}

      {(isQR || isBarcode) && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">
            {isQR ? 'QR Code' : 'Barcode'}
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Content</span>
            <textarea
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-accent"
              rows={3}
              value={state.content}
              onChange={(e) => apply({ content: e.target.value })}
            />
          </label>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Transform</p>
        <div className="grid grid-cols-2 gap-2">
          {([['x', 'X'], ['y', 'Y']] as const).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">{label}</span>
              <input
                type="number"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                value={state[key]}
                onChange={(e) => apply({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          {!isCircle && !isLine && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">W</span>
                <input
                  type="number"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.width}
                  onChange={(e) => apply({ width: Number(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">H</span>
                <input
                  type="number"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.height}
                  onChange={(e) => apply({ height: Number(e.target.value) })}
                />
              </label>
            </>
          )}
          {isCircle && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">RX</span>
                <input
                  type="number"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.radiusX}
                  onChange={(e) => apply({ radiusX: Number(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">RY</span>
                <input
                  type="number"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.radiusY}
                  onChange={(e) => apply({ radiusY: Number(e.target.value) })}
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-xs text-gray-400">Rotation</span>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.rotation}
              min={-180}
              max={180}
              onChange={(e) => apply({ rotation: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      {(isRectObj || isCircle) && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Style</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Fill</span>
            <input
              type="color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.fill}
              onChange={(e) => apply({ fill: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke</span>
            <input
              type="color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.stroke}
              onChange={(e) => apply({ stroke: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke width</span>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.strokeWidth}
              min={0}
              max={20}
              onChange={(e) => apply({ strokeWidth: Number(e.target.value) })}
            />
          </label>
        </section>
      )}

      {isLine && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Style</p>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke</span>
            <input
              type="color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.stroke}
              onChange={(e) => apply({ stroke: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke width</span>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.strokeWidth}
              min={0}
              max={20}
              onChange={(e) => apply({ strokeWidth: Number(e.target.value) })}
            />
          </label>
        </section>
      )}
    </div>
  )
}
