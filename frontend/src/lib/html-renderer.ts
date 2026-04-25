import html2canvas from 'html2canvas'
import { canvasTo1BitBitmap } from './label-renderer'
import { applyVariables, escapeHtml } from './canvas-utils'

export async function htmlTo1BitBitmap(
  html: string,
  w: number,
  h: number,
  variableValues: Record<string, string>
): Promise<{ bitmap: Uint8Array; width: number; height: number }> {
  const escapedValues = Object.fromEntries(
    Object.entries(variableValues).map(([k, v]) => [k, escapeHtml(v)])
  )
  const processedHtml = applyVariables(html, escapedValues)

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '-9999px'
  iframe.style.width = `${w}px`
  iframe.style.height = `${h}px`
  iframe.style.border = 'none'
  iframe.style.visibility = 'hidden'
  iframe.sandbox.add('allow-same-origin')
  iframe.srcdoc = processedHtml

  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.addEventListener('load', () => resolve())
      iframe.addEventListener('error', () => reject(new Error('iframe failed to load')))
    })

    const canvas = await html2canvas(iframe.contentDocument!.body, {
      width: w,
      height: h,
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 1,
    } as Parameters<typeof html2canvas>[1])

    return canvasTo1BitBitmap(canvas, w, h)
  } finally {
    document.body.removeChild(iframe)
  }
}
