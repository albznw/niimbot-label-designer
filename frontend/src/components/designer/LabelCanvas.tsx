import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import {
  Stage,
  Layer,
  Text,
  Rect,
  Ellipse,
  Line,
  Image as KonvaImage,
  Transformer,
} from 'react-konva'
import Konva from 'konva'
import type { Template } from '../../types/project'
import { getCanvasDims } from '../../types/label'
import type { LabelDisplaySettings } from '../../types/label'
import {
  applyVariables,
  generateQRDataURL,
  generateBarcodeDataURLAsync,
  konvaStageToCanvas,
} from '../../lib/canvas-utils'
import { canvasTo1BitBitmap, rotateBitmap90CW } from '../../lib/label-renderer'
import type { DitherAlgorithm, ImageDitherRegion } from '../../lib/label-renderer'
import type { Tool } from './ToolSidebar'
import type { AlignDirection } from './AlignPanel'
import type { AlignDocDirection } from './DocAlignPanel'

export type NodeConfig =
  | {
      id: string
      type: 'text'
      x: number
      y: number
      width: number
      rotation: number
      text: string
      fontSize: number
      fontStyle: string // 'normal' | 'bold' | 'italic' | 'bold italic'
      fontFamily: string
      align: string
      fill: string
    }
  | {
      id: string
      type: 'rect'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      fill: string
      stroke: string
      strokeWidth: number
    }
  | {
      id: string
      type: 'circle'
      x: number
      y: number
      radiusX: number
      radiusY: number
      fill: string
      stroke: string
      strokeWidth: number
      draggable: true
      rotation: number
    }
  | {
      id: string
      type: 'line'
      x: number
      y: number
      points: number[]
      stroke: string
      strokeWidth: number
      draggable: true
      rotation: number
    }
  | {
      id: string
      type: 'image'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      src: string
      ditherAlgorithm?: DitherAlgorithm
      ditherThreshold?: number
    }
  | {
      id: string
      type: 'qr'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      content: string
      src: string
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    }
  | {
      id: string
      type: 'barcode'
      x: number
      y: number
      width: number
      height: number
      rotation: number
      content: string
      src: string
    }

export interface LabelCanvasHandle {
  addText: () => void
  addRect: () => void
  addCircle: () => void
  addLine: () => void
  addQR: (content: string) => Promise<void>
  addBarcode: (content: string) => Promise<void>
  deleteSelected: () => void
  copySelected: () => void
  pasteSelected: () => void
  alignSelected: (direction: AlignDirection) => void
  alignToDocument: (direction: AlignDocDirection) => void
  getSelectedObject: () => NodeConfig | NodeConfig[] | null
  getCanvas: () => Konva.Stage | null
  updateSelected: (patch: Record<string, unknown>) => void
  getNodes: () => NodeConfig[]
  getSelectedIds: () => string[]
  selectNode: (id: string) => void
  moveToFront: (id: string) => void
  moveToBack: (id: string) => void
  moveForward: (id: string) => void
  moveBackward: (id: string) => void
  triggerImageUpload: () => void
  addImage: (src: string) => void
}

interface LabelCanvasProps {
  template: Template
  variableValues: Record<string, string>
  activeTool: Tool
  labelSettings: LabelDisplaySettings
  onCanvasChange: (json: string) => void
  onBitmapUpdate: (bitmap: Uint8Array, w: number, h: number) => void
  onSelectionChange: (objs: NodeConfig[]) => void
  onToolUsed: () => void
}

let nodeIdCounter = 0
function genId(prefix: string): string {
  nodeIdCounter += 1
  return `${prefix}-${Date.now()}-${nodeIdCounter}`
}

interface CanvasData {
  version: 1
  nodes: NodeConfig[]
}

function parseCanvasJson(json: string | null): NodeConfig[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (n): n is NodeConfig =>
          n && typeof n === 'object' && typeof n.id === 'string' && typeof n.type === 'string'
      )
    }
    if (parsed && typeof parsed === 'object' && parsed.version === 1) {
      const data = parsed as Partial<CanvasData>
      return Array.isArray(data.nodes)
        ? data.nodes.filter(
            (n): n is NodeConfig =>
              n != null &&
              typeof n === 'object' &&
              typeof (n as NodeConfig).id === 'string' &&
              typeof (n as NodeConfig).type === 'string'
          )
        : []
    }
    return []
  } catch {
    return []
  }
}

// Compute bounding box of a node in stage coords (axis-aligned, rotation ignored for simplicity)
function getNodeBBox(node: NodeConfig): { x: number; y: number; width: number; height: number } {
  if (node.type === 'text' || node.type === 'rect' || node.type === 'image' || node.type === 'qr' || node.type === 'barcode') {
    const h = 'height' in node ? node.height : 0
    const w = 'width' in node ? node.width : 0
    return { x: node.x, y: node.y, width: w, height: h }
  }
  if (node.type === 'circle') {
    return {
      x: node.x - node.radiusX,
      y: node.y - node.radiusY,
      width: node.radiusX * 2,
      height: node.radiusY * 2,
    }
  }
  if (node.type === 'line') {
    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < node.points.length; i += 2) {
      xs.push(node.points[i] + node.x)
      ys.push(node.points[i + 1] + node.y)
    }
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    }
  }
  return { x: 0, y: 0, width: 0, height: 0 }
}

// Set top-left x of a node (bbox aware)
function setNodeX(node: NodeConfig, newX: number): Partial<NodeConfig> {
  const bbox = getNodeBBox(node)
  const dx = newX - bbox.x
  return { x: node.x + dx } as Partial<NodeConfig>
}

function setNodeY(node: NodeConfig, newY: number): Partial<NodeConfig> {
  const bbox = getNodeBBox(node)
  const dy = newY - bbox.y
  return { y: node.y + dy } as Partial<NodeConfig>
}

// Hook wrapper for async image loading for KonvaImage
function useImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!src) {
      setImg(null)
      return
    }
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    let cancelled = false
    image.onload = () => {
      if (!cancelled) setImg(image)
    }
    image.onerror = () => {
      if (!cancelled) setImg(null)
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [src])
  return img
}

interface ImageNodeProps {
  node: Extract<NodeConfig, { type: 'image' }>
  onSelect: (e: Konva.KonvaEventObject<Event>) => void
  onChange: (patch: Partial<NodeConfig>) => void
  shapeRef: (n: Konva.Node | null) => void
}

function ImageNode({ node, onSelect, onChange, shapeRef }: ImageNodeProps) {
  const image = useImage(node.src)
  const localRef = useRef<Konva.Image>(null)
  useEffect(() => {
    shapeRef(localRef.current)
    return () => shapeRef(null)
  }, [shapeRef])
  return (
    <KonvaImage
      ref={localRef}
      id={node.id}
      image={image ?? undefined}
      x={node.x}
      y={node.y}
      width={node.width}
      height={node.height}
      rotation={node.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({ x: e.target.x(), y: e.target.y() })
      }}
      onTransformEnd={(e) => {
        const n = e.target
        const sx = n.scaleX()
        const sy = n.scaleY()
        const newWidth = Math.max(4, n.width() * sx)
        const newHeight = Math.max(4, n.height() * sy)
        n.scaleX(1)
        n.scaleY(1)
        onChange({
          x: n.x(),
          y: n.y(),
          width: newWidth,
          height: newHeight,
          rotation: n.rotation(),
        })
      }}
    />
  )
}

const SNAP_THRESHOLD = 6

export const LabelCanvas = forwardRef<LabelCanvasHandle, LabelCanvasProps>(
  function LabelCanvas(
    {
      template,
      variableValues,
      activeTool,
      labelSettings,
      onCanvasChange,
      onBitmapUpdate,
      onSelectionChange,
      onToolUsed,
    },
    ref
  ) {
    const STAGE_PAD = 80
    const dims = useMemo(
      () => getCanvasDims(template.label_size, labelSettings.orientation),
      [template.label_size, labelSettings.orientation]
    )

    const [zoom, setZoom] = useState(1)

    const [nodes, setNodes] = useState<NodeConfig[]>(() =>
      parseCanvasJson(template.canvas_json)
    )
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
    const [editingValue, setEditingValue] = useState<string>('')
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const [textareaStyle, setTextareaStyle] = useState<CSSProperties>({})
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const pendingImagePosRef = useRef<{ x: number; y: number } | null>(null)

    const stageRef = useRef<Konva.Stage | null>(null)
    const layerRef = useRef<Konva.Layer | null>(null)
    const guideLayerRef = useRef<Konva.Layer | null>(null)
    const transformerRef = useRef<Konva.Transformer | null>(null)
    const nodeRefs = useRef<Map<string, Konva.Node>>(new Map())
    const copiedNodesRef = useRef<NodeConfig[]>([])

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const historyRef = useRef<NodeConfig[][]>([])
    const historyIndexRef = useRef(-1)
    const isUndoRedoRef = useRef(false)
    const nodesRef = useRef(nodes)
    const selectedIdsRef = useRef(selectedIds)
    const activeToolRef = useRef(activeTool)
    const variableValuesRef = useRef(variableValues)
    const onCanvasChangeRef = useRef(onCanvasChange)
    const onBitmapUpdateRef = useRef(onBitmapUpdate)
    const onSelectionChangeRef = useRef(onSelectionChange)
    const onToolUsedRef = useRef(onToolUsed)

    useEffect(() => {
      nodesRef.current = nodes
    }, [nodes])
    useEffect(() => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false
        return
      }
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current.push(JSON.parse(JSON.stringify(nodes)))
      historyIndexRef.current = historyRef.current.length - 1
      if (historyRef.current.length > 50) {
        historyRef.current.shift()
        historyIndexRef.current--
      }
    }, [nodes])
    useEffect(() => {
      selectedIdsRef.current = selectedIds
    }, [selectedIds])
    useEffect(() => {
      activeToolRef.current = activeTool
    }, [activeTool])
    useEffect(() => {
      onCanvasChangeRef.current = onCanvasChange
    }, [onCanvasChange])
    useEffect(() => {
      onBitmapUpdateRef.current = onBitmapUpdate
    }, [onBitmapUpdate])
    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange
    }, [onSelectionChange])
    useEffect(() => {
      onToolUsedRef.current = onToolUsed
    }, [onToolUsed])

    // Reload nodes when template id changes (new template loaded)
    useEffect(() => {
      setNodes(parseCanvasJson(template.canvas_json))
      setSelectedIds([])
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template.id])

    // Notify selection changes
    useEffect(() => {
      const selected = nodes.filter((n) => selectedIds.includes(n.id))
      onSelectionChangeRef.current(selected)
    }, [selectedIds, nodes])

    // Attach transformer to all selected nodes
    useEffect(() => {
      const transformer = transformerRef.current
      if (!transformer) return
      if (selectedIds.length === 0) {
        transformer.nodes([])
        transformer.getLayer()?.batchDraw()
        return
      }
      const selectedKonvaNodes = selectedIds
        .map((id) => nodeRefs.current.get(id))
        .filter((n): n is Konva.Node => n != null)
      transformer.nodes(selectedKonvaNodes)
      transformer.getLayer()?.batchDraw()
    }, [selectedIds, nodes])

    const renderBitmap = useCallback(async () => {
      const stage = stageRef.current
      if (!stage) return
      const vars = variableValuesRef.current
      const w = dims.w
      const h = dims.h

      // Temporarily hide transformer and guides for clean render
      const transformer = transformerRef.current
      const transformerWasVisible = transformer?.visible() ?? false
      if (transformer) {
        transformer.visible(false)
      }
      const guideLayer = guideLayerRef.current
      const guideLayerWasVisible = guideLayer?.visible() ?? false
      if (guideLayer) {
        guideLayer.visible(false)
      }

      // Temporarily substitute variables in text nodes
      const restores: Array<{ node: Konva.Text; original: string }> = []
      stage.find('Text').forEach((k) => {
        const t = k as Konva.Text
        const original = t.text() ?? ''
        const substituted = applyVariables(original, vars)
        if (substituted !== original) {
          restores.push({ node: t, original })
          t.text(substituted)
        }
      })
      stage.batchDraw()

      const srcCanvas = await konvaStageToCanvas(stage, w, h, STAGE_PAD, STAGE_PAD)
      const imageRegions: ImageDitherRegion[] = nodesRef.current
        .filter((n) => n.type === 'image')
        .map((n) => ({
          x: n.x,
          y: n.y,
          w: (n as Extract<typeof n, { type: 'image' }>).width,
          h: (n as Extract<typeof n, { type: 'image' }>).height,
          algorithm: (n as Extract<typeof n, { type: 'image' }>).ditherAlgorithm ?? 'threshold',
          threshold: (n as Extract<typeof n, { type: 'image' }>).ditherThreshold ?? 128,
        }))
        .filter((r) => r.algorithm !== 'threshold' || r.threshold !== 128)
      const { bitmap } = canvasTo1BitBitmap(srcCanvas, w, h, imageRegions)

      // Restore
      restores.forEach(({ node, original }) => node.text(original))
      if (transformer && transformerWasVisible) {
        transformer.visible(true)
      }
      if (guideLayer && guideLayerWasVisible) {
        guideLayer.visible(true)
      }
      stage.batchDraw()

      // Rotate bitmap 90° CW for portrait 50x30 so printer always gets 400x240
      let finalBitmap = bitmap
      let finalW = w
      let finalH = h
      if (
        template.label_size === '50x30' &&
        labelSettings.orientation === 'portrait'
      ) {
        const rotated = rotateBitmap90CW(bitmap, w, h)
        finalBitmap = rotated.bitmap
        finalW = rotated.w
        finalH = rotated.h
      }

      onBitmapUpdateRef.current(finalBitmap, finalW, finalH)
    }, [dims, template.label_size, labelSettings.orientation])

    const scheduleUpdate = useCallback(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        const data: CanvasData = {
          version: 1,
          nodes: nodesRef.current,
        }
        const json = JSON.stringify(data)
        onCanvasChangeRef.current(json)
        await renderBitmap()
      }, 300)
    }, [renderBitmap])

    // Schedule update on any node/settings change
    useEffect(() => {
      scheduleUpdate()
    }, [nodes, scheduleUpdate])

    // Re-render bitmap when variable preview values change
    useEffect(() => {
      variableValuesRef.current = variableValues
      // Regenerate QR/barcode src with substituted variables
      const qrBarcodeNodes = nodesRef.current.filter(
        (n) => n.type === 'qr' || n.type === 'barcode'
      )
      if (qrBarcodeNodes.length > 0) {
        qrBarcodeNodes.forEach((n) => {
          const resolved = applyVariables((n as { content?: string }).content ?? '', variableValues)
          if (n.type === 'qr') {
            generateQRDataURL(resolved, n.width, n.errorCorrectionLevel).then((src) => {
              setNodes((prev) =>
                prev.map((node) => (node.id === n.id ? ({ ...node, src } as NodeConfig) : node))
              )
            })
          } else {
            generateBarcodeDataURLAsync(resolved, n.width, n.height).then((src) => {
              setNodes((prev) =>
                prev.map((node) => (node.id === n.id ? ({ ...node, src } as NodeConfig) : node))
              )
            })
          }
        })
      } else {
        renderBitmap()
      }
    }, [variableValues, renderBitmap])

    // Initial bitmap render after mount
    useEffect(() => {
      const t = setTimeout(() => {
        renderBitmap()
      }, 50)
      return () => clearTimeout(t)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template.id])

    // Re-render when orientation or label size changes (canvas dims change)
    useEffect(() => {
      renderBitmap()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [labelSettings.orientation, template.label_size])

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }, [])

    const updateNode = useCallback((id: string, patch: Partial<NodeConfig>) => {
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? ({ ...n, ...patch } as NodeConfig) : n))
      )
      if ('content' in patch || 'errorCorrectionLevel' in patch) {
        const node = nodesRef.current.find((n) => n.id === id)
        if (!node) return
        const newContent = ('content' in patch ? (patch as { content: string }).content : null) ?? (node.type === 'qr' || node.type === 'barcode' ? node.content : '')
        const ecl = ('errorCorrectionLevel' in patch ? (patch as { errorCorrectionLevel: 'L'|'M'|'Q'|'H' }).errorCorrectionLevel : null) ?? (node.type === 'qr' ? node.errorCorrectionLevel : undefined)
        if (node.type === 'qr') {
          generateQRDataURL(newContent, node.width, ecl).then((src) => {
            setNodes((prev) =>
              prev.map((n) => (n.id === id ? ({ ...n, src } as NodeConfig) : n))
            )
          })
        } else if (node.type === 'barcode') {
          generateBarcodeDataURLAsync(newContent, node.width, node.height).then((src) => {
            setNodes((prev) =>
              prev.map((n) => (n.id === id ? ({ ...n, src } as NodeConfig) : n))
            )
          })
        }
      }
    }, [])

    const startEdit = useCallback((id: string) => {
      const node = nodes.find((n) => n.id === id)
      if (!node || node.type !== 'text') return
      setEditingNodeId(id)
      setEditingValue(node.text ?? '')
    }, [nodes])

    const commitEdit = useCallback(() => {
      if (!editingNodeId) return
      updateNode(editingNodeId, { text: editingValue })
      setEditingNodeId(null)
    }, [editingNodeId, editingValue, updateNode])

    const cancelEdit = useCallback(() => {
      setEditingNodeId(null)
    }, [])

    useEffect(() => {
      if (!editingNodeId) return
      const stage = stageRef.current
      if (!stage) return
      const konvaNode = stage.findOne('#' + editingNodeId) as Konva.Text | undefined
      if (!konvaNode) return
      const stageRect = stage.container().getBoundingClientRect()
      const absPos = konvaNode.getAbsolutePosition()
      const w = Math.max(konvaNode.width() * zoom, 60)
      const h = Math.max(konvaNode.height() * zoom, konvaNode.fontSize() * zoom * 1.5)
      const rotation = konvaNode.rotation()
      setTextareaStyle({
        position: 'fixed',
        left: stageRect.left + absPos.x * zoom,
        top: stageRect.top + absPos.y * zoom,
        width: w,
        minHeight: h,
        fontSize: konvaNode.fontSize() * zoom,
        fontFamily: konvaNode.fontFamily(),
        fontWeight: konvaNode.fontStyle()?.includes('bold') ? 'bold' : 'normal',
        fontStyle: konvaNode.fontStyle()?.includes('italic') ? 'italic' : 'normal',
        textAlign: konvaNode.align() as CSSProperties['textAlign'],
        color: konvaNode.fill() as string,
        background: 'rgba(20,20,20,0.95)',
        border: '1.5px solid rgba(59,130,246,0.8)',
        outline: 'none',
        padding: '0px',
        resize: 'none',
        zIndex: 1000,
        lineHeight: '1.2',
        overflow: 'hidden',
        borderRadius: '2px',
        boxSizing: 'border-box',
        ...(rotation ? { transform: `rotate(${rotation}deg)`, transformOrigin: '0 0' } : {}),
      })
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.select()
        }
      }, 0)
    }, [editingNodeId, zoom])

    const registerNodeRef = useCallback((id: string) => {
      return (n: Konva.Node | null) => {
        if (n) nodeRefs.current.set(id, n)
        else nodeRefs.current.delete(id)
      }
    }, [])

    const addTextAt = useCallback((x: number, y: number) => {
      const id = genId('text')
      const newNode: NodeConfig = {
        id,
        type: 'text',
        x,
        y,
        width: 160,
        rotation: 0,
        text: 'Label text',
        fontSize: 24,
        fontStyle: 'normal',
        fontFamily: 'Arial',
        align: 'left',
        fill: '#000000',
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const addRectAt = useCallback((x: number, y: number) => {
      const id = genId('rect')
      const newNode: NodeConfig = {
        id,
        type: 'rect',
        x,
        y,
        width: 80,
        height: 40,
        rotation: 0,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const addCircleAt = useCallback((x: number, y: number) => {
      const id = genId('circle')
      const newNode: NodeConfig = {
        id,
        type: 'circle',
        x: x + 30,
        y: y + 30,
        radiusX: 30,
        radiusY: 30,
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 2,
        draggable: true,
        rotation: 0,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const addLineAt = useCallback((x: number, y: number) => {
      const id = genId('line')
      const newNode: NodeConfig = {
        id,
        type: 'line',
        x,
        y,
        points: [0, 0, 100, 0],
        stroke: '#000000',
        strokeWidth: 2,
        draggable: true,
        rotation: 0,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const addQRAt = useCallback(async (x: number, y: number, content: string) => {
      const dataUrl = await generateQRDataURL(content, 80, 'M')
      const id = genId('qr')
      const newNode: NodeConfig = {
        id,
        type: 'qr',
        x,
        y,
        width: 80,
        height: 80,
        rotation: 0,
        content,
        src: dataUrl,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const addImageAt = useCallback(async (x: number, y: number, dataUrl: string) => {
      return new Promise<string>((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => {
          const naturalW = img.naturalWidth || img.width || 100
          const naturalH = img.naturalHeight || img.height || 100
          const maxW = 100
          let w = naturalW
          let h = naturalH
          if (w > maxW) {
            const ratio = maxW / w
            w = maxW
            h = Math.max(1, Math.round(naturalH * ratio))
          }
          const id = genId('image')
          const newNode: NodeConfig = {
            id,
            type: 'image',
            x,
            y,
            width: w,
            height: h,
            rotation: 0,
            src: dataUrl,
          }
          setNodes((prev) => [...prev, newNode])
          setSelectedIds([id])
          resolve(id)
        }
        img.onerror = () => reject(new Error('Image failed to load'))
        img.src = dataUrl
      })
    }, [])

    const addBarcodeAt = useCallback(async (x: number, y: number, content: string) => {
      const dataUrl = await generateBarcodeDataURLAsync(content, 120, 40)
      const id = genId('barcode')
      const newNode: NodeConfig = {
        id,
        type: 'barcode',
        x,
        y,
        width: 120,
        height: 40,
        rotation: 0,
        content,
        src: dataUrl,
      }
      setNodes((prev) => [...prev, newNode])
      setSelectedIds([id])
      return id
    }, [])

    const deleteSelectedInternal = useCallback(() => {
      const ids = selectedIdsRef.current
      if (ids.length === 0) return
      setNodes((prev) => prev.filter((n) => !ids.includes(n.id)))
      setSelectedIds([])
    }, [])

    const copySelectedInternal = useCallback(() => {
      const ids = selectedIdsRef.current
      const selected = nodesRef.current.filter((n) => ids.includes(n.id))
      if (selected.length === 0) return
      copiedNodesRef.current = JSON.parse(JSON.stringify(selected)) as NodeConfig[]
    }, [])

    const pasteSelectedInternal = useCallback(() => {
      const copies = copiedNodesRef.current
      if (!copies || copies.length === 0) return
      const newNodes: NodeConfig[] = copies.map((c) => {
        const clone = JSON.parse(JSON.stringify(c)) as NodeConfig
        clone.id = genId(clone.type)
        clone.x = (clone.x ?? 0) + 15
        clone.y = (clone.y ?? 0) + 15
        return clone
      })
      setNodes((prev) => [...prev, ...newNodes])
      setSelectedIds(newNodes.map((n) => n.id))
    }, [])

    const alignSelectedInternal = useCallback((direction: AlignDirection) => {
      const ids = selectedIdsRef.current
      if (ids.length < 2) return
      const targets = nodesRef.current.filter((n) => ids.includes(n.id))
      if (targets.length < 2) return

      const bboxes = targets.map((n) => ({ node: n, bbox: getNodeBBox(n) }))
      const lefts = bboxes.map((b) => b.bbox.x)
      const rights = bboxes.map((b) => b.bbox.x + b.bbox.width)
      const tops = bboxes.map((b) => b.bbox.y)
      const bottoms = bboxes.map((b) => b.bbox.y + b.bbox.height)
      const centersX = bboxes.map((b) => b.bbox.x + b.bbox.width / 2)
      const centersY = bboxes.map((b) => b.bbox.y + b.bbox.height / 2)

      const minLeft = Math.min(...lefts)
      const maxRight = Math.max(...rights)
      const minTop = Math.min(...tops)
      const maxBottom = Math.max(...bottoms)
      const avgCenterX = centersX.reduce((a, b) => a + b, 0) / centersX.length
      const avgCenterY = centersY.reduce((a, b) => a + b, 0) / centersY.length

      setNodes((prev) =>
        prev.map((n) => {
          if (!ids.includes(n.id)) return n
          const bbox = getNodeBBox(n)
          let patch: Partial<NodeConfig> = {}
          switch (direction) {
            case 'left':
              patch = setNodeX(n, minLeft)
              break
            case 'right':
              patch = setNodeX(n, maxRight - bbox.width)
              break
            case 'center-h':
              patch = setNodeX(n, avgCenterX - bbox.width / 2)
              break
            case 'top':
              patch = setNodeY(n, minTop)
              break
            case 'bottom':
              patch = setNodeY(n, maxBottom - bbox.height)
              break
            case 'middle-v':
              patch = setNodeY(n, avgCenterY - bbox.height / 2)
              break
          }
          return { ...n, ...patch } as NodeConfig
        })
      )
    }, [])

    const alignToDocumentInternal = useCallback((direction: AlignDocDirection) => {
      const ids = selectedIdsRef.current
      if (ids.length === 0) return
      const targets = nodesRef.current.filter((n) => ids.includes(n.id))
      if (targets.length === 0) return

      setNodes((prev) =>
        prev.map((n) => {
          if (!ids.includes(n.id)) return n
          let patch: Partial<NodeConfig> = {}
          if (n.type === 'circle') {
            switch (direction) {
              case 'left':
                patch = { x: n.radiusX }
                break
              case 'center-h':
                patch = { x: dims.w / 2 }
                break
              case 'right':
                patch = { x: dims.w - n.radiusX }
                break
              case 'top':
                patch = { y: n.radiusY }
                break
              case 'middle-v':
                patch = { y: dims.h / 2 }
                break
              case 'bottom':
                patch = { y: dims.h - n.radiusY }
                break
            }
          } else {
            const bbox = getNodeBBox(n)
            switch (direction) {
              case 'left':
                patch = setNodeX(n, 0)
                break
              case 'center-h':
                patch = setNodeX(n, (dims.w - bbox.width) / 2)
                break
              case 'right':
                patch = setNodeX(n, dims.w - bbox.width)
                break
              case 'top':
                patch = setNodeY(n, 0)
                break
              case 'middle-v':
                patch = setNodeY(n, (dims.h - bbox.height) / 2)
                break
              case 'bottom':
                patch = setNodeY(n, dims.h - bbox.height)
                break
            }
          }
          return { ...n, ...patch } as NodeConfig
        })
      )
      scheduleUpdate()
    }, [dims, scheduleUpdate])

    const moveToFrontInternal = useCallback((id: string) => {
      setNodes((prev) => {
        const idx = prev.findIndex((n) => n.id === id)
        if (idx < 0 || idx === prev.length - 1) return prev
        const next = prev.slice()
        const [item] = next.splice(idx, 1)
        next.push(item)
        return next
      })
    }, [])

    const moveToBackInternal = useCallback((id: string) => {
      setNodes((prev) => {
        const idx = prev.findIndex((n) => n.id === id)
        if (idx <= 0) return prev
        const next = prev.slice()
        const [item] = next.splice(idx, 1)
        next.unshift(item)
        return next
      })
    }, [])

    const moveForwardInternal = useCallback((id: string) => {
      setNodes((prev) => {
        const idx = prev.findIndex((n) => n.id === id)
        if (idx < 0 || idx === prev.length - 1) return prev
        const next = prev.slice()
        const item = next[idx]
        next[idx] = next[idx + 1]
        next[idx + 1] = item
        return next
      })
    }, [])

    const moveBackwardInternal = useCallback((id: string) => {
      setNodes((prev) => {
        const idx = prev.findIndex((n) => n.id === id)
        if (idx <= 0) return prev
        const next = prev.slice()
        const item = next[idx]
        next[idx] = next[idx - 1]
        next[idx - 1] = item
        return next
      })
    }, [])

    useImperativeHandle(ref, () => ({
      addText() {
        addTextAt(20, 20)
      },
      addRect() {
        addRectAt(20, 20)
      },
      addCircle() {
        addCircleAt(20, 20)
      },
      addLine() {
        addLineAt(20, 20)
      },
      async addQR(content: string) {
        await addQRAt(20, 20, content)
      },
      async addBarcode(content: string) {
        await addBarcodeAt(20, 20, content)
      },
      deleteSelected() {
        deleteSelectedInternal()
      },
      copySelected() {
        copySelectedInternal()
      },
      pasteSelected() {
        pasteSelectedInternal()
      },
      alignSelected(direction: AlignDirection) {
        alignSelectedInternal(direction)
      },
      alignToDocument(direction: AlignDocDirection) {
        alignToDocumentInternal(direction)
      },
      getSelectedObject() {
        const ids = selectedIdsRef.current
        if (ids.length === 0) return null
        const selected = nodesRef.current.filter((n) => ids.includes(n.id))
        if (selected.length === 1) return selected[0]
        return selected
      },
      getCanvas() {
        return stageRef.current
      },
      updateSelected(patch: Record<string, unknown>) {
        const ids = selectedIdsRef.current
        if (ids.length !== 1) return
        updateNode(ids[0], patch as Partial<NodeConfig>)
      },
      getNodes() {
        return nodesRef.current
      },
      getSelectedIds() {
        return selectedIdsRef.current
      },
      selectNode(id: string) {
        setSelectedIds([id])
      },
      moveToFront(id: string) {
        moveToFrontInternal(id)
      },
      moveToBack(id: string) {
        moveToBackInternal(id)
      },
      moveForward(id: string) {
        moveForwardInternal(id)
      },
      moveBackward(id: string) {
        moveBackwardInternal(id)
      },
      triggerImageUpload() {
        pendingImagePosRef.current = { x: Math.round(dims.w / 2), y: Math.round(dims.h / 2) }
        fileInputRef.current?.click()
      },
      addImage(src: string) {
        const ICON_SIZE = 60
        const x = Math.round(dims.w / 2 - ICON_SIZE / 2)
        const y = Math.round(dims.h / 2 - ICON_SIZE / 2)
        fetch(src)
          .then((r) => r.blob())
          .then((blob) => {
            const reader = new FileReader()
            reader.onload = () => {
              const result = reader.result
              if (typeof result !== 'string') return
              const img = new window.Image()
              img.onload = () => {
                const naturalW = img.naturalWidth || ICON_SIZE
                const naturalH = img.naturalHeight || ICON_SIZE
                const scale = Math.min(ICON_SIZE / naturalW, ICON_SIZE / naturalH)
                const w = Math.max(1, Math.round(naturalW * scale))
                const h = Math.max(1, Math.round(naturalH * scale))
                const id = genId('image')
                const newNode: NodeConfig = {
                  id,
                  type: 'image',
                  x,
                  y,
                  width: w,
                  height: h,
                  rotation: 0,
                  src: result,
                }
                setNodes((prev) => [...prev, newNode])
                setSelectedIds([id])
              }
              img.src = result
            }
            reader.readAsDataURL(blob)
          })
          .catch(() => {
            // swallow errors; nothing to surface here
          })
      },
    }))

    // Keyboard shortcuts: copy/paste/delete
    useEffect(() => {
      const isEditableTarget = (el: EventTarget | null): boolean => {
        if (!(el instanceof HTMLElement)) return false
        const tag = el.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
        if (el.isContentEditable) return true
        return false
      }
      const handleKeyDown = (e: KeyboardEvent) => {
        if (isEditableTarget(e.target)) return
        const mod = e.ctrlKey || e.metaKey
        if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
          // Redo
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++
            isUndoRedoRef.current = true
            setNodes(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])) as NodeConfig[])
          }
          e.preventDefault()
          return
        }
        if (mod && e.key.toLowerCase() === 'z') {
          // Undo
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--
            isUndoRedoRef.current = true
            setNodes(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])) as NodeConfig[])
          }
          e.preventDefault()
          return
        }
        if (!mod && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          if (selectedIdsRef.current.length === 0) return
          const delta = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -delta : e.key === 'ArrowRight' ? delta : 0
          const dy = e.key === 'ArrowUp' ? -delta : e.key === 'ArrowDown' ? delta : 0
          setNodes((prev) =>
            prev.map((n) =>
              selectedIdsRef.current.includes(n.id)
                ? ({ ...n, x: (n.x ?? 0) + dx, y: (n.y ?? 0) + dy } as NodeConfig)
                : n
            )
          )
          e.preventDefault()
          return
        }
        if (mod && e.key.toLowerCase() === 'c') {
          copySelectedInternal()
          e.preventDefault()
          return
        }
        if (mod && e.key.toLowerCase() === 'v') {
          pasteSelectedInternal()
          e.preventDefault()
          return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedIdsRef.current.length === 0) return
          deleteSelectedInternal()
          e.preventDefault()
          return
        }
        if (mod && e.key === ']') {
          const ids = selectedIdsRef.current
          if (ids.length !== 1) return
          moveForwardInternal(ids[0])
          e.preventDefault()
          return
        }
        if (mod && e.key === '[') {
          const ids = selectedIdsRef.current
          if (ids.length !== 1) return
          moveBackwardInternal(ids[0])
          e.preventDefault()
          return
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [
      copySelectedInternal,
      pasteSelectedInternal,
      deleteSelectedInternal,
      moveForwardInternal,
      moveBackwardInternal,
    ])

    // Selection helpers
    const handleSelectNode = useCallback(
      (id: string, e: Konva.KonvaEventObject<Event>) => {
        const evt = e.evt as unknown as { shiftKey?: boolean }
        const shift = !!evt?.shiftKey
        setSelectedIds((prev) => {
          if (shift) {
            if (prev.includes(id)) return prev.filter((x) => x !== id)
            return [...prev, id]
          }
          return [id]
        })
      },
      []
    )

    // Stage click/mouse-down - deselect or add element by tool
    const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const target = e.target
      const stage = target.getStage()
      const isBg = target === stage || target.name() === 'bg'
      if (!isBg) return

      const tool = activeToolRef.current
      const pos = stage?.getPointerPosition()
      if (!pos) {
        setSelectedIds([])
        return
      }
      const x = pos.x - STAGE_PAD
      const y = pos.y - STAGE_PAD

      if (tool === 'select') {
        setSelectedIds([])
        return
      }

      if (tool === 'text') {
        addTextAt(x, y)
        onToolUsedRef.current()
        return
      }
      if (tool === 'rect') {
        addRectAt(x, y)
        onToolUsedRef.current()
        return
      }
      if (tool === 'circle') {
        addCircleAt(x, y)
        onToolUsedRef.current()
        return
      }
      if (tool === 'line') {
        addLineAt(x, y)
        onToolUsedRef.current()
        return
      }
      if (tool === 'qr') {
        const content = window.prompt('QR code content', '{{url}}')
        if (content != null) {
          void addQRAt(x, y, content)
        }
        onToolUsedRef.current()
        return
      }
      if (tool === 'barcode') {
        const content = window.prompt('Barcode content', '{{barcode}}')
        if (content != null) {
          void addBarcodeAt(x, y, content)
        }
        onToolUsedRef.current()
        return
      }
    }


    const handleImageInputChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const pos = pendingImagePosRef.current
      // Reset input value so same file re-selection re-fires onChange
      e.target.value = ''
      pendingImagePosRef.current = null
      if (!file || !pos) return
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === 'string') {
          void addImageAt(pos.x, pos.y, result).then(() => {
            onToolUsedRef.current()
          })
        }
      }
      reader.readAsDataURL(file)
    }

    // --- Snap guides ---
    const clearGuides = useCallback(() => {
      const gl = guideLayerRef.current
      if (!gl) return
      gl.destroyChildren()
      gl.batchDraw()
    }, [])

    const drawGuide = useCallback((orientation: 'v' | 'h', pos: number) => {
      const gl = guideLayerRef.current
      if (!gl) return
      const line = new Konva.Line({
        stroke: '#ff3b30',
        strokeWidth: 1,
        dash: [4, 4],
        listening: false,
        points:
          orientation === 'v'
            ? [pos, 0, pos, dims.h]
            : [0, pos, dims.w, pos],
      })
      gl.add(line)
    }, [dims.h, dims.w])

    // Returns snap points for a given node using current konva-reported x/y
    const getSnapPointsForKonva = (node: Konva.Node): { vertical: number[]; horizontal: number[] } => {
      const x = node.x()
      const y = node.y()
      const cr = node as unknown as { width?: () => number; height?: () => number }
      const w = typeof cr.width === 'function' ? cr.width() : 0
      const h = typeof cr.height === 'function' ? cr.height() : 0
      // Approximation: use bounding rect where possible
      try {
        const rect = (node as Konva.Shape).getClientRect({ skipTransform: false })
        return {
          vertical: [rect.x, rect.x + rect.width / 2, rect.x + rect.width],
          horizontal: [rect.y, rect.y + rect.height / 2, rect.y + rect.height],
        }
      } catch {
        return {
          vertical: [x, x + w / 2, x + w],
          horizontal: [y, y + h / 2, y + h],
        }
      }
    }

    const handleStageDragMove = useCallback(
      (e: Konva.KonvaEventObject<DragEvent>) => {
        const gl = guideLayerRef.current
        if (!gl) return
        const dragged = e.target
        // Ignore stage-level drags (shouldn't happen but guard)
        if (dragged === stageRef.current) return
        // Ignore transformer
        if (dragged.getClassName() === 'Transformer') return

        const draggedId = dragged.id()
        if (!draggedId) return

        const snap = getSnapPointsForKonva(dragged)
        // Build guide source points from other nodes and canvas
        const vSources: number[] = [0, dims.w / 2, dims.w]
        const hSources: number[] = [0, dims.h / 2, dims.h]
        nodesRef.current.forEach((n) => {
          if (n.id === draggedId) return
          const k = nodeRefs.current.get(n.id)
          if (!k) return
          const snaps = getSnapPointsForKonva(k)
          vSources.push(...snaps.vertical)
          hSources.push(...snaps.horizontal)
        })

        gl.destroyChildren()

        let bestVDelta = 0
        let bestVGuideLine: number | null = null
        let bestVAbs = Infinity
        snap.vertical.forEach((pt) => {
          vSources.forEach((src) => {
            const d = src - pt
            const ad = Math.abs(d)
            if (ad <= SNAP_THRESHOLD && ad < bestVAbs) {
              bestVAbs = ad
              bestVDelta = d
              bestVGuideLine = src
            }
          })
        })

        let bestHDelta = 0
        let bestHGuideLine: number | null = null
        let bestHAbs = Infinity
        snap.horizontal.forEach((pt) => {
          hSources.forEach((src) => {
            const d = src - pt
            const ad = Math.abs(d)
            if (ad <= SNAP_THRESHOLD && ad < bestHAbs) {
              bestHAbs = ad
              bestHDelta = d
              bestHGuideLine = src
            }
          })
        })

        if (bestVGuideLine != null) {
          dragged.x(dragged.x() + bestVDelta)
          drawGuide('v', bestVGuideLine)
        }
        if (bestHGuideLine != null) {
          dragged.y(dragged.y() + bestHDelta)
          drawGuide('h', bestHGuideLine)
        }
        gl.batchDraw()
      },
      [dims.h, dims.w, drawGuide]
    )

    const handleStageDragEnd = useCallback(() => {
      clearGuides()
    }, [clearGuides])

    const containerRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
        setZoom((z) => Math.max(0.25, Math.min(8, z * factor)))
      }
      el.addEventListener('wheel', onWheel, { passive: false })
      return () => el.removeEventListener('wheel', onWheel)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files?.[0]
      if (!file) return
      if (!file.type.startsWith('image/')) return
      const stage = stageRef.current
      if (!stage) return
      const stageRect = stage.container().getBoundingClientRect()
      const x = Math.max(0, Math.round((e.clientX - stageRect.left) / zoom) - STAGE_PAD)
      const y = Math.max(0, Math.round((e.clientY - stageRect.top) / zoom) - STAGE_PAD)
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') void addImageAt(x, y, reader.result)
      }
      reader.readAsDataURL(file)
    }, [zoom, addImageAt])

    return (
      <div
        ref={containerRef}
        className="flex items-center justify-center flex-1 bg-[#1a1a1a] overflow-auto p-4"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,image/*"
          style={{ display: 'none' }}
          onChange={handleImageInputChange}
        />
        <div
          className="shadow-2xl border border-white/10"
          style={{ lineHeight: 0, transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.05s ease-out' }}
        >
          <Stage
            width={dims.w + STAGE_PAD * 2}
            height={dims.h + STAGE_PAD * 2}
            ref={stageRef}
            onMouseDown={handleStageMouseDown}
            onTouchStart={handleStageMouseDown}
            onDragMove={handleStageDragMove}
            onDragEnd={handleStageDragEnd}
          >
            <Layer
              ref={layerRef}
              x={STAGE_PAD}
              y={STAGE_PAD}
              clipFunc={(ctx) => {
                const isRounded = labelSettings.cornerStyle === 'rounded'
                const is30x30 = template.label_size === '30x30'
                ctx.beginPath()
                if (!isRounded) {
                  ctx.rect(0, 0, dims.w, dims.h)
                } else if (is30x30) {
                  const r = Math.min(dims.w, dims.h / 2) * 0.08
                  if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(0, 0, dims.w, dims.h / 2, [r, r, 0, 0])
                    ctx.roundRect(0, dims.h / 2, dims.w, dims.h / 2, [0, 0, r, r])
                  } else {
                    ctx.rect(0, 0, dims.w, dims.h)
                  }
                } else {
                  const r = Math.min(dims.w, dims.h) * 0.08
                  if (typeof ctx.roundRect === 'function') {
                    ctx.roundRect(0, 0, dims.w, dims.h, r)
                  } else {
                    ctx.rect(0, 0, dims.w, dims.h)
                  }
                }
                ctx.closePath()
              }}
            >
              <Rect
                x={0}
                y={0}
                width={dims.w}
                height={dims.h}
                fill="white"
                cornerRadius={
                  labelSettings.cornerStyle === 'rounded' && template.label_size !== '30x30'
                    ? Math.min(dims.w, dims.h) * 0.08
                    : 0
                }
                listening={true}
                name="bg"
              />
              {nodes.map((node) => {
                if (node.type === 'text') {
                  return (
                    <Text
                      key={node.id}
                      id={node.id}
                      ref={registerNodeRef(node.id)}
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      rotation={node.rotation}
                      text={node.text}
                      fontSize={node.fontSize}
                      fontStyle={node.fontStyle}
                      fontFamily={node.fontFamily}
                      align={node.align}
                      fill={node.fill}
                      draggable
                      visible={editingNodeId !== node.id}
                      onClick={(e) => handleSelectNode(node.id, e)}
                      onTap={(e) => handleSelectNode(node.id, e)}
                      onDblClick={() => startEdit(node.id)}
                      onDblTap={() => startEdit(node.id)}
                      onDragEnd={(e) => {
                        updateNode(node.id, { x: e.target.x(), y: e.target.y() })
                      }}
                      onTransformEnd={(e) => {
                        const n = e.target as Konva.Text
                        const sx = n.scaleX()
                        const newWidth = Math.max(20, n.width() * sx)
                        n.scaleX(1)
                        n.scaleY(1)
                        updateNode(node.id, {
                          x: n.x(),
                          y: n.y(),
                          width: newWidth,
                          rotation: n.rotation(),
                        })
                      }}
                    />
                  )
                }
                if (node.type === 'rect') {
                  return (
                    <Rect
                      key={node.id}
                      id={node.id}
                      ref={registerNodeRef(node.id)}
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rotation={node.rotation}
                      fill={node.fill}
                      stroke={node.stroke}
                      strokeWidth={node.strokeWidth}
                      draggable
                      onClick={(e) => handleSelectNode(node.id, e)}
                      onTap={(e) => handleSelectNode(node.id, e)}
                      onDragEnd={(e) => {
                        updateNode(node.id, { x: e.target.x(), y: e.target.y() })
                      }}
                      onTransformEnd={(e) => {
                        const n = e.target as Konva.Rect
                        const sx = n.scaleX()
                        const sy = n.scaleY()
                        const newWidth = Math.max(4, n.width() * sx)
                        const newHeight = Math.max(4, n.height() * sy)
                        n.scaleX(1)
                        n.scaleY(1)
                        updateNode(node.id, {
                          x: n.x(),
                          y: n.y(),
                          width: newWidth,
                          height: newHeight,
                          rotation: n.rotation(),
                        })
                      }}
                    />
                  )
                }
                if (node.type === 'circle') {
                  return (
                    <Ellipse
                      key={node.id}
                      id={node.id}
                      ref={registerNodeRef(node.id)}
                      x={node.x}
                      y={node.y}
                      radiusX={node.radiusX}
                      radiusY={node.radiusY}
                      fill={node.fill}
                      stroke={node.stroke}
                      strokeWidth={node.strokeWidth}
                      rotation={node.rotation}
                      draggable
                      onClick={(e) => handleSelectNode(node.id, e)}
                      onTap={(e) => handleSelectNode(node.id, e)}
                      onDragEnd={(e) => {
                        updateNode(node.id, { x: e.target.x(), y: e.target.y() })
                      }}
                      onTransformEnd={(e) => {
                        const n = e.target as Konva.Ellipse
                        const sx = n.scaleX()
                        const sy = n.scaleY()
                        const newRX = Math.max(2, n.radiusX() * sx)
                        const newRY = Math.max(2, n.radiusY() * sy)
                        n.scaleX(1)
                        n.scaleY(1)
                        updateNode(node.id, {
                          x: n.x(),
                          y: n.y(),
                          radiusX: newRX,
                          radiusY: newRY,
                          rotation: n.rotation(),
                        })
                      }}
                    />
                  )
                }
                if (node.type === 'line') {
                  return (
                    <Line
                      key={node.id}
                      id={node.id}
                      ref={registerNodeRef(node.id)}
                      x={node.x}
                      y={node.y}
                      points={node.points}
                      stroke={node.stroke}
                      strokeWidth={node.strokeWidth}
                      rotation={node.rotation}
                      hitStrokeWidth={Math.max(10, node.strokeWidth + 6)}
                      draggable
                      onClick={(e) => handleSelectNode(node.id, e)}
                      onTap={(e) => handleSelectNode(node.id, e)}
                      onDragEnd={(e) => {
                        updateNode(node.id, { x: e.target.x(), y: e.target.y() })
                      }}
                      onTransformEnd={(e) => {
                        const n = e.target as Konva.Line
                        const sx = n.scaleX()
                        const sy = n.scaleY()
                        const pts = n.points()
                        const newPts: number[] = []
                        for (let i = 0; i < pts.length; i += 2) {
                          newPts.push(pts[i] * sx, pts[i + 1] * sy)
                        }
                        n.scaleX(1)
                        n.scaleY(1)
                        updateNode(node.id, {
                          x: n.x(),
                          y: n.y(),
                          points: newPts,
                          rotation: n.rotation(),
                        })
                      }}
                    />
                  )
                }
                if (node.type === 'image') {
                  return (
                    <ImageNode
                      key={node.id}
                      node={node}
                      onSelect={(e) => handleSelectNode(node.id, e)}
                      onChange={(patch) => updateNode(node.id, patch)}
                      shapeRef={registerNodeRef(node.id)}
                    />
                  )
                }
                if (node.type === 'qr' || node.type === 'barcode') {
                  return (
                    <ImageNode
                      key={node.id}
                      node={node as unknown as Extract<NodeConfig, { type: 'image' }>}
                      onSelect={(e) => handleSelectNode(node.id, e)}
                      onChange={(patch) => updateNode(node.id, patch)}
                      shapeRef={registerNodeRef(node.id)}
                    />
                  )
                }
                return null
              })}
            </Layer>
            <Layer x={STAGE_PAD} y={STAGE_PAD}>
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 5 || newBox.height < 5) return oldBox
                  return newBox
                }}
              />
            </Layer>
            <Layer ref={guideLayerRef} x={STAGE_PAD} y={STAGE_PAD} listening={false} />
          </Stage>
        </div>
        {editingNodeId && (
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit() }
            }}
          />
        )}
      </div>
    )
  }
)
