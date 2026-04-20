import { NiimbotBluetoothClient, ImageEncoder } from '@mmote/niimbluelib'
import html2canvas from 'html2canvas'
import type { LabelSize, SubLabel } from './templates'

export const LABEL_DIMS: Record<LabelSize, { w: number; h: number; rotate: boolean }> = {
  '50x30': { w: 400, h: 240, rotate: true },
  '30x50': { w: 240, h: 400, rotate: false },
  '30x30': { w: 240, h: 240, rotate: true },
}

let client: NiimbotBluetoothClient | null = null

export function isConnected(): boolean {
  return client?.isConnected() ?? false
}

export async function connectPrinter(onDisconnect: () => void): Promise<string> {
  if (client?.isConnected()) {
    await client.disconnect()
    client = null
  }
  client = new NiimbotBluetoothClient()
  client.on('disconnect', onDisconnect)
  const info = await client.connect()
  await client.fetchPrinterInfo()
  return info.deviceName ?? 'Unknown device'
}

export async function disconnectPrinter(): Promise<void> {
  if (client) {
    await client.disconnect()
    client = null
  }
}

function toBlackWhite(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas')
  dst.width = src.width
  dst.height = src.height
  const ctx = dst.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, dst.width, dst.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = lum < 128 ? 0 : 255
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return dst
}

function clampToSize(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (src.width === w && src.height === h) return src
  const dst = document.createElement('canvas')
  dst.width = w
  dst.height = h
  dst.getContext('2d')!.drawImage(src, 0, 0, w, h)
  return dst
}

function rotateCanvas90CCW(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas')
  dst.width = src.height
  dst.height = src.width
  const ctx = dst.getContext('2d')!
  ctx.translate(0, src.width)
  ctx.rotate(-Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return dst
}

async function captureToCanvas(html: string, w: number, h: number, js?: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-9999px',
    top: '-9999px',
    width: `${w}px`,
    height: `${h}px`,
    border: 'none',
    visibility: 'hidden',
  })
  document.body.appendChild(iframe)
  try {
    await new Promise<void>((resolve) => {
      iframe.addEventListener('load', () => resolve(), { once: true })
      iframe.srcdoc = html
    })

    if (js?.trim()) {
      const doc = iframe.contentDocument!
      const win = iframe.contentWindow as Window & { __done?: Promise<void> }
      const script = doc.createElement('script')
      script.textContent = `(async () => { try { ${js} } catch(e) { console.error('[label ts]', e); } })();`
      doc.body.appendChild(script)
      if (win.__done instanceof Promise) {
        await Promise.race([win.__done, new Promise(r => setTimeout(r, 2000))])
      } else {
        await new Promise(r => setTimeout(r, 100))
      }
    }

    return await html2canvas(iframe.contentDocument!.body, {
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 1,
    })
  } finally {
    document.body.removeChild(iframe)
  }
}

export async function captureLabel(
  html: string,
  labelSize: LabelSize,
  subLabel: SubLabel,
  js?: string,
): Promise<HTMLCanvasElement> {
  const { w, h } = LABEL_DIMS[labelSize]
  let canvas = await captureToCanvas(html, w, h, js)
  canvas = clampToSize(canvas, w, h)

  if (labelSize === '30x30') {
    const half = document.createElement('canvas')
    half.width = w
    half.height = 120
    const ctx = half.getContext('2d')!
    ctx.drawImage(canvas, 0, subLabel === 'top' ? 0 : 120, w, 120, 0, 0, w, 120)
    canvas = half
  }

  return toBlackWhite(canvas)
}

export async function printLabel(
  html: string,
  labelSize: LabelSize,
  subLabel: SubLabel,
  js?: string,
): Promise<void> {
  if (!client?.isConnected()) throw new Error('Not connected to printer')
  let canvas = await captureLabel(html, labelSize, subLabel, js)
  if (LABEL_DIMS[labelSize].rotate) canvas = rotateCanvas90CCW(canvas)
  const encoded = ImageEncoder.encodeCanvas(canvas)
  const printTask = client.abstraction.newPrintTask('B1', { totalPages: 1, density: 3 })
  try {
    await printTask.printInit()
    await printTask.printPage(encoded, 1)
    await printTask.waitForPageFinished()
    await printTask.waitForFinished()
  } finally {
    await client.abstraction.printEnd()
  }
}
