import { useEffect, useState, useCallback } from 'react'
import { IText, Rect, FabricObject } from 'fabric'
import type { Canvas } from 'fabric'

interface PropertiesPanelProps {
  selectedObject: unknown
  canvas: Canvas | null
}

function isIText(obj: unknown): obj is IText {
  return obj instanceof IText
}

function isRect(obj: unknown): obj is Rect {
  return obj instanceof Rect
}

function isFabricObject(obj: unknown): obj is FabricObject {
  return obj instanceof FabricObject
}

interface ObjState {
  x: number
  y: number
  width: number
  height: number
  angle: number
  // text
  text: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  textAlign: string
  // rect
  fill: string
  stroke: string
  strokeWidth: number
}

function readState(obj: unknown): ObjState {
  const defaults: ObjState = {
    x: 0, y: 0, width: 0, height: 0, angle: 0,
    text: '', fontSize: 20, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left',
    fill: '#ffffff', stroke: '#000000', strokeWidth: 1,
  }
  if (!isFabricObject(obj)) return defaults
  const fo = obj as FabricObject
  return {
    x: Math.round(fo.left ?? 0),
    y: Math.round(fo.top ?? 0),
    width: Math.round((fo.width ?? 0) * (fo.scaleX ?? 1)),
    height: Math.round((fo.height ?? 0) * (fo.scaleY ?? 1)),
    angle: Math.round(fo.angle ?? 0),
    text: isIText(obj) ? (obj.text ?? '') : '',
    fontSize: isIText(obj) ? (obj.fontSize ?? 20) : 20,
    fontWeight: isIText(obj) ? String(obj.fontWeight ?? 'normal') : 'normal',
    fontStyle: isIText(obj) ? String(obj.fontStyle ?? 'normal') : 'normal',
    textAlign: isIText(obj) ? (obj.textAlign ?? 'left') : 'left',
    fill: isRect(obj) ? String(fo.fill ?? '#ffffff') : '#ffffff',
    stroke: isRect(obj) ? String(fo.stroke ?? '#000000') : '#000000',
    strokeWidth: isRect(obj) ? (fo.strokeWidth ?? 1) : 1,
  }
}

export function PropertiesPanel({ selectedObject, canvas }: PropertiesPanelProps) {
  const [state, setState] = useState<ObjState>(readState(selectedObject))

  useEffect(() => {
    setState(readState(selectedObject))
  }, [selectedObject])

  const apply = useCallback((patch: Partial<ObjState>) => {
    if (!isFabricObject(selectedObject) || !canvas) return
    const fo = selectedObject as FabricObject
    const next = { ...state, ...patch }
    setState(next)

    const updates: Record<string, unknown> = {
      left: next.x,
      top: next.y,
      angle: next.angle,
    }

    // Width/height via scale
    if ((fo.width ?? 0) > 0) updates.scaleX = next.width / (fo.width ?? 1)
    if ((fo.height ?? 0) > 0) updates.scaleY = next.height / (fo.height ?? 1)

    if (isIText(selectedObject)) {
      updates.text = next.text
      updates.fontSize = next.fontSize
      updates.fontWeight = next.fontWeight
      updates.fontStyle = next.fontStyle
      updates.textAlign = next.textAlign
    }

    if (isRect(selectedObject)) {
      updates.fill = next.fill
      updates.stroke = next.stroke
      updates.strokeWidth = next.strokeWidth
    }

    fo.set(updates)
    canvas.renderAll()
    canvas.fire('object:modified', { target: fo })
  }, [selectedObject, canvas, state])

  if (!isFabricObject(selectedObject)) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-xs text-gray-500 text-center">Select an element to edit its properties</p>
      </div>
    )
  }

  const isText = isIText(selectedObject)
  const isRectObj = isRect(selectedObject)

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
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

      <section className="flex flex-col gap-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">Transform</p>
        <div className="grid grid-cols-2 gap-2">
          {([['x', 'X'], ['y', 'Y'], ['width', 'W'], ['height', 'H']] as const).map(([key, label]) => (
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
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-xs text-gray-400">Rotation</span>
            <input
              type="number"
              className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
              value={state.angle}
              min={-180}
              max={180}
              onChange={(e) => apply({ angle: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      {isRectObj && (
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
    </div>
  )
}
