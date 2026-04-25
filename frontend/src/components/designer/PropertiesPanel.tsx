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
  // image
  ditherAlgorithm: 'threshold' | 'floyd-steinberg' | 'atkinson' | 'ordered'
  ditherThreshold: number
  // line
  lineLength: number
  lineAngle: number
  // text height
  heightMode: 'auto' | 'manual'
  verticalAlign: string
  // qr / barcode
  content: string
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
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
    ditherAlgorithm: 'threshold' as const,
    ditherThreshold: 128,
    heightMode: 'auto' as const,
    verticalAlign: 'top',
    lineLength: 100,
    lineAngle: 0,
    content: '',
    errorCorrectionLevel: 'M' as const,
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
      height: node.heightMode === 'manual' && node.height ? Math.round(node.height) : 0,
      heightMode: node.heightMode ?? 'auto',
      verticalAlign: node.verticalAlign ?? 'top',
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
    const pts = node.points ?? [0, 0, 100, 0]
    const dx = (pts[2] ?? 100) - (pts[0] ?? 0)
    const dy = (pts[3] ?? 0) - (pts[1] ?? 0)
    return {
      ...base,
      stroke: String(node.stroke ?? '#000000'),
      strokeWidth: node.strokeWidth ?? 1,
      lineLength: Math.round(Math.sqrt(dx * dx + dy * dy)),
      lineAngle: Math.round(Math.atan2(dy, dx) * (180 / Math.PI)),
    }
  }

  if (node.type === 'qr' || node.type === 'barcode') {
    return {
      ...base,
      width: Math.round(node.width ?? 0),
      height: Math.round(node.height ?? 0),
      content: node.content ?? '',
      errorCorrectionLevel: node.type === 'qr' ? (node.errorCorrectionLevel ?? 'M') : 'M',
    }
  }

  // image
  return {
    ...base,
    width: Math.round(node.width ?? 0),
    height: Math.round(node.height ?? 0),
    ditherAlgorithm: ((node as Extract<NodeConfig, { type: 'image' }>).ditherAlgorithm ?? 'threshold') as ObjState['ditherAlgorithm'],
    ditherThreshold: (node as Extract<NodeConfig, { type: 'image' }>).ditherThreshold ?? 128,
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
        nodePatch.heightMode = next.heightMode
        nodePatch.height = next.heightMode === 'manual' ? next.height : undefined
        nodePatch.verticalAlign = next.heightMode === 'manual' ? next.verticalAlign : undefined
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
        const rad = next.lineAngle * (Math.PI / 180)
        nodePatch.points = [0, 0, Math.round(next.lineLength * Math.cos(rad)), Math.round(next.lineLength * Math.sin(rad))]
      }

      if (single.type === 'image') {
        nodePatch.width = next.width
        nodePatch.height = next.height
        nodePatch.ditherAlgorithm = next.ditherAlgorithm
        nodePatch.ditherThreshold = next.ditherThreshold
      }

      if (single.type === 'qr' || single.type === 'barcode') {
        nodePatch.width = next.width
        nodePatch.height = next.height
        nodePatch.content = next.content
        if (single.type === 'qr') nodePatch.errorCorrectionLevel = next.errorCorrectionLevel
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
  const isImage = node.type === 'image'
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
              name="text-content"
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
              name="font-size"
              autoComplete="off"
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
                name="font-family"
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
                name="font-family"
                autoComplete="off"
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

          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Height</span>
            <div className="flex gap-1">
              {(['auto', 'manual'] as const).map((mode) => (
                <button
                  key={mode}
                  className={`flex-1 py-1 rounded text-xs border transition-colors ${state.heightMode === mode ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}
                  onClick={() => apply({ heightMode: mode })}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {state.heightMode === 'manual' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">Height</span>
                <input
                  type="number"
                  name="text-height"
                  autoComplete="off"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white w-full focus:outline-none focus:border-accent"
                  value={state.height}
                  min={4}
                  onChange={(e) => apply({ height: Number(e.target.value) })}
                />
              </label>
              <div className="flex gap-1">
                {(['top', 'middle', 'bottom'] as const).map((a) => (
                  <button
                    key={a}
                    className={`flex-1 py-1 rounded text-xs border transition-colors ${state.verticalAlign === a ? 'border-accent bg-accent/20 text-white' : 'border-white/20 text-gray-400 hover:border-white/40'}`}
                    onClick={() => apply({ verticalAlign: a })}
                  >
                    {a[0].toUpperCase() + a.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}
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
              name="qr-content"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1.5 text-xs text-white resize-none focus:outline-none focus:border-accent"
              rows={3}
              value={state.content}
              onChange={(e) => apply({ content: e.target.value })}
            />
          </label>
          {isQR && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Error correction</span>
              <div className="flex gap-1">
                {(['L', 'M', 'Q', 'H'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => apply({ errorCorrectionLevel: lvl })}
                    title={{ L: '7%', M: '15%', Q: '25%', H: '30%' }[lvl]}
                    className={`flex-1 text-xs py-1 rounded border transition-colors ${
                      state.errorCorrectionLevel === lvl
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                name={key}
                autoComplete="off"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                value={state[key]}
                onChange={(e) => apply({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          {!isCircle && !isLine && !isText && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">W</span>
                <input
                  type="number"
                  name="width"
                  autoComplete="off"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.width}
                  onChange={(e) => apply({ width: Number(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">H</span>
                <input
                  type="number"
                  name="height"
                  autoComplete="off"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.height}
                  onChange={(e) => apply({ height: Number(e.target.value) })}
                />
              </label>
            </>
          )}
          {!isCircle && !isLine && isText && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">W</span>
              <input
                type="number"
                name="width"
                autoComplete="off"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                value={state.width}
                onChange={(e) => apply({ width: Number(e.target.value) })}
              />
            </label>
          )}
          {isCircle && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">RX</span>
                <input
                  type="number"
                  name="radius-x"
                  autoComplete="off"
                  className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                  value={state.radiusX}
                  onChange={(e) => apply({ radiusX: Number(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">RY</span>
                <input
                  type="number"
                  name="radius-y"
                  autoComplete="off"
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
              name="rotation"
              autoComplete="off"
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
              name="fill-color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.fill}
              onChange={(e) => apply({ fill: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke</span>
            <input
              type="color"
              name="stroke-color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.stroke}
              onChange={(e) => apply({ stroke: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Stroke width</span>
            <input
              type="number"
              name="stroke-width"
              autoComplete="off"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.strokeWidth}
              min={0}
              max={20}
              onChange={(e) => apply({ strokeWidth: Number(e.target.value) })}
            />
          </label>
        </section>
      )}

      {isImage && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Dithering</p>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Algorithm</span>
            <div className="grid grid-cols-2 gap-1">
              {(['threshold', 'floyd-steinberg', 'atkinson', 'ordered'] as const).map((alg) => (
                <button
                  key={alg}
                  type="button"
                  onClick={() => apply({
                    ditherAlgorithm: state.ditherAlgorithm === alg ? 'threshold' : alg,
                    ditherThreshold: state.ditherAlgorithm === alg ? 128 : state.ditherThreshold,
                  })}
                  className={`text-xs py-1 px-1 rounded border transition-colors capitalize ${
                    state.ditherAlgorithm === alg
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-[#1a1a1a] text-gray-300 border-white/20 hover:bg-[#242424]'
                  }`}
                >
                  {alg === 'floyd-steinberg' ? 'Floyd-S.' : alg[0].toUpperCase() + alg.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Threshold ({state.ditherThreshold})</span>
            <input
              type="range"
              name="dither-threshold"
              min={0}
              max={255}
              value={state.ditherThreshold}
              onChange={(e) => apply({ ditherThreshold: Number(e.target.value) })}
              className="w-full"
            />
          </label>
        </section>
      )}

      {isLine && (
        <section className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Line</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Length</span>
              <input
                type="number"
                name="line-length"
                autoComplete="off"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                value={state.lineLength}
                min={1}
                onChange={(e) => apply({ lineLength: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-400">Angle °</span>
              <input
                type="number"
                name="line-angle"
                autoComplete="off"
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                value={state.lineAngle}
                min={-180}
                max={180}
                onChange={(e) => apply({ lineAngle: Number(e.target.value) })}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Color</span>
            <input
              type="color"
              name="line-color"
              className="w-full h-8 rounded border border-white/20 bg-[#1a1a1a] cursor-pointer"
              value={state.stroke}
              onChange={(e) => apply({ stroke: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">Thickness</span>
            <input
              type="number"
              name="stroke-width"
              autoComplete="off"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.strokeWidth}
              min={1}
              max={20}
              onChange={(e) => apply({ strokeWidth: Number(e.target.value) })}
            />
          </label>
        </section>
      )}
    </div>
  )
}
