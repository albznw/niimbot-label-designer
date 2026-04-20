import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react'
import {
  Canvas,
  IText,
  Rect,
  FabricImage,
} from 'fabric'
import type { Template } from '../../types/project'
import { LABEL_DIMS } from '../../types/label'
import { applyVariables, generateQRDataURL, generateBarcodeDataURLAsync, fabricToCanvas } from '../../lib/fabric-utils'
import { canvasTo1BitBitmap } from '../../lib/label-renderer'

export interface LabelCanvasHandle {
  addText: () => void
  addRect: () => void
  addQR: (content: string) => Promise<void>
  addBarcode: (content: string) => Promise<void>
  deleteSelected: () => void
  getSelectedObject: () => unknown
  getCanvas: () => Canvas | null
}

interface LabelCanvasProps {
  template: Template
  variableValues: Record<string, string>
  onCanvasChange: (json: string) => void
  onBitmapUpdate: (bitmap: Uint8Array, w: number, h: number) => void
  onSelectionChange: (obj: unknown) => void
}

export const LabelCanvas = forwardRef<LabelCanvasHandle, LabelCanvasProps>(
  function LabelCanvas({ template, variableValues, onCanvasChange, onBitmapUpdate, onSelectionChange }, ref) {
    const canvasElRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<Canvas | null>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const variableValuesRef = useRef(variableValues)
    const onCanvasChangeRef = useRef(onCanvasChange)
    const onBitmapUpdateRef = useRef(onBitmapUpdate)
    const onSelectionChangeRef = useRef(onSelectionChange)

    // Keep refs in sync without re-running effects
    useEffect(() => { onCanvasChangeRef.current = onCanvasChange }, [onCanvasChange])
    useEffect(() => { onBitmapUpdateRef.current = onBitmapUpdate }, [onBitmapUpdate])
    useEffect(() => { onSelectionChangeRef.current = onSelectionChange }, [onSelectionChange])

    const dims = LABEL_DIMS[template.label_size]

    const renderBitmap = useCallback(async (canvas: Canvas) => {
      const vars = variableValuesRef.current
      const w = dims.w
      const h = dims.h

      // Temporarily substitute variables in text objects
      const restores: Array<{ obj: IText; original: string }> = []
      canvas.getObjects().forEach((obj) => {
        if (obj instanceof IText) {
          const original = obj.text ?? ''
          const substituted = applyVariables(original, vars)
          if (substituted !== original) {
            restores.push({ obj, original })
            obj.set('text', substituted)
          }
        }
      })
      canvas.renderAll()

      const srcCanvas = await fabricToCanvas(canvas, w, h)
      const { bitmap } = canvasTo1BitBitmap(srcCanvas, w, h)

      // Restore original text
      restores.forEach(({ obj, original }) => obj.set('text', original))
      canvas.renderAll()

      onBitmapUpdateRef.current(bitmap, w, h)
    }, [dims])

    const scheduleUpdate = useCallback((canvas: Canvas) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const json = JSON.stringify(canvas.toJSON())
        onCanvasChangeRef.current(json)
        await renderBitmap(canvas)
      }, 300)
    }, [renderBitmap])

    // Re-render bitmap when variable preview values change
    useEffect(() => {
      variableValuesRef.current = variableValues
      const canvas = fabricRef.current
      if (canvas) renderBitmap(canvas)
    }, [variableValues, renderBitmap])

    useEffect(() => {
      if (!canvasElRef.current) return

      let alive = true

      const init = async () => {
        if (!alive || !canvasElRef.current) return

        const canvas = new Canvas(canvasElRef.current, {
          width: dims.w,
          height: dims.h,
          backgroundColor: '#ffffff',
          selection: true,
        })
        fabricRef.current = canvas

        if (template.canvas_json) {
          await canvas.loadFromJSON(JSON.parse(template.canvas_json))
          if (!alive) return
          canvas.renderAll()
        }
        await renderBitmap(canvas)
        if (!alive) return

        const handleModified = () => scheduleUpdate(canvas)
        canvas.on('object:modified', handleModified)
        canvas.on('object:added', handleModified)
        canvas.on('object:removed', handleModified)
        canvas.on('selection:created', () => onSelectionChangeRef.current(canvas.getActiveObject()))
        canvas.on('selection:updated', () => onSelectionChangeRef.current(canvas.getActiveObject()))
        canvas.on('selection:cleared', () => onSelectionChangeRef.current(null))
      }

      init()

      return () => {
        alive = false
        if (debounceRef.current) clearTimeout(debounceRef.current)
        const c = fabricRef.current
        fabricRef.current = null
        if (c) c.dispose()
      }
      // Only run on mount / template id change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template.id])

    useImperativeHandle(ref, () => ({
      addText() {
        const canvas = fabricRef.current
        if (!canvas) return
        const text = new IText('Label text', {
          left: 20,
          top: 20,
          fontSize: 24,
          fill: '#000000',
          fontFamily: 'Arial',
        })
        canvas.add(text)
        canvas.setActiveObject(text)
        canvas.renderAll()
      },

      addRect() {
        const canvas = fabricRef.current
        if (!canvas) return
        const rect = new Rect({
          left: 20,
          top: 20,
          width: 80,
          height: 40,
          fill: '#ffffff',
          stroke: '#000000',
          strokeWidth: 2,
        })
        canvas.add(rect)
        canvas.setActiveObject(rect)
        canvas.renderAll()
      },

      async addQR(content: string) {
        const canvas = fabricRef.current
        if (!canvas) return
        const dataUrl = await generateQRDataURL(content, 80)
        const img = await FabricImage.fromURL(dataUrl)
        img.set({ left: 20, top: 20 })
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()
      },

      async addBarcode(content: string) {
        const canvas = fabricRef.current
        if (!canvas) return
        const dataUrl = await generateBarcodeDataURLAsync(content, 120, 40)
        const img = await FabricImage.fromURL(dataUrl)
        img.set({ left: 20, top: 20 })
        canvas.add(img)
        canvas.setActiveObject(img)
        canvas.renderAll()
      },

      deleteSelected() {
        const canvas = fabricRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (!active) return
        canvas.remove(active)
        canvas.discardActiveObject()
        canvas.renderAll()
      },

      getSelectedObject() {
        return fabricRef.current?.getActiveObject() ?? null
      },

      getCanvas() {
        return fabricRef.current
      },
    }))

    return (
      <div className="flex items-center justify-center flex-1 bg-[#1a1a1a] overflow-auto p-4">
        <div
          className="shadow-2xl border border-white/10"
          style={{ lineHeight: 0 }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    )
  }
)
