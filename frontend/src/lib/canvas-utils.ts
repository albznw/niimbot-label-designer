import type Konva from 'konva'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'

export function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`)
}

export async function konvaStageToCanvas(
  stage: Konva.Stage,
  w: number,
  h: number,
  offsetX = 0,
  offsetY = 0
): Promise<HTMLCanvasElement> {
  return stage.toCanvas({ x: offsetX, y: offsetY, width: w, height: h, pixelRatio: 1 }) as HTMLCanvasElement
}

export async function generateQRDataURL(
  content: string,
  size: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'M'
): Promise<string> {
  // Generate at 4x to ensure downscaling (sharper than upscaling)
  const renderSize = Math.max(size * 4, 400)
  return QRCode.toDataURL(content, {
    width: renderSize,
    margin: 1,
    errorCorrectionLevel,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export async function generateBarcodeDataURLAsync(
  content: string,
  _width: number,
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
  svgNode.setAttribute('shape-rendering', 'crispEdges')
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgNode)
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
}
