import { Canvas } from 'fabric'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

export function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`)
}

export async function fabricToCanvas(
  fabricCanvas: Canvas,
  w: number,
  h: number
): Promise<HTMLCanvasElement> {
  const src = fabricCanvas.toCanvasElement()
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')!
  ctx.drawImage(src, 0, 0, w, h)
  return tmp
}

export async function generateQRDataURL(content: string, size: number): Promise<string> {
  return QRCode.toDataURL(content, {
    width: size,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export function generateBarcodeDataURL(content: string, width: number, height: number): string {
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svgNode, content, {
    format: 'CODE128',
    width: 2,
    height,
    displayValue: false,
    background: '#ffffff',
    lineColor: '#000000',
  })
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgNode)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const img = new Image()
  img.src = url
  // Synchronous render isn't possible for SVG blob; return data URL from canvas
  // The actual rendering happens async - caller should use generateBarcodeDataURLAsync
  return canvas.toDataURL()
}

export async function generateBarcodeDataURLAsync(
  content: string,
  width: number,
  height: number
): Promise<string> {
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svgNode, content, {
    format: 'CODE128',
    width: 2,
    height,
    displayValue: false,
    background: '#ffffff',
    lineColor: '#000000',
  })
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgNode)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL())
    }
    img.onerror = reject
    img.src = url
  })
}
