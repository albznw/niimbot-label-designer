import { bitmapToCanvas } from './label-renderer'

export async function bitmapToPngBase64(
  bitmap: Uint8Array,
  width: number,
  height: number
): Promise<string> {
  const canvas = bitmapToCanvas(bitmap, width, height)
  const dataUrl = canvas.toDataURL('image/png')
  return dataUrl.replace(/^data:image\/png;base64,/, '')
}
