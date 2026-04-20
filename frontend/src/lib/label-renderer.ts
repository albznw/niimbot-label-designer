export function canvasTo1BitBitmap(
  canvas: HTMLCanvasElement,
  w: number,
  h: number
): { bitmap: Uint8Array; width: number; height: number } {
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const bitmap = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    bitmap[i] = lum < 128 ? 0 : 255
  }
  return { bitmap, width: w, height: h }
}

export function bitmapToImageData(
  bitmap: Uint8Array,
  width: number,
  height: number
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    const v = bitmap[i]
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  return new ImageData(data, width, height)
}

export function bitmapToCanvas(
  bitmap: Uint8Array,
  width: number,
  height: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const imageData = bitmapToImageData(bitmap, width, height)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Rotate a bitmap 90° clockwise.
 * Mapping: new[r][c] = old[h-1-c][r]  where newW=h, newH=w.
 */
export function rotateBitmap90CW(
  bitmap: Uint8Array,
  w: number,
  h: number
): { bitmap: Uint8Array; w: number; h: number } {
  const newW = h
  const newH = w
  const out = new Uint8Array(newW * newH)
  for (let r = 0; r < newH; r++) {
    for (let c = 0; c < newW; c++) {
      out[r * newW + c] = bitmap[(h - 1 - c) * w + r]
    }
  }
  return { bitmap: out, w: newW, h: newH }
}
