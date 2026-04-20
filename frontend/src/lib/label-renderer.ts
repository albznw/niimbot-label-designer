export type DitherAlgorithm = 'threshold' | 'floyd-steinberg' | 'atkinson' | 'ordered'

export interface ImageDitherRegion {
  x: number
  y: number
  w: number
  h: number
  algorithm: DitherAlgorithm
  threshold: number
}

const BAYER_4X4 = [
  [ 0,  8,  2, 10],
  [12,  4, 14,  6],
  [ 3, 11,  1,  9],
  [15,  7, 13,  5],
]

function applyFloydSteinberg(gray: Float32Array, canvasW: number, region: ImageDitherRegion): void {
  const { x: rx, y: ry, w, h, threshold } = region
  const sub = new Float32Array(w * h)
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++)
      sub[row * w + col] = gray[(ry + row) * canvasW + (rx + col)]

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const old = sub[row * w + col]
      const neu = old < threshold ? 0 : 255
      sub[row * w + col] = neu
      const err = old - neu
      if (col + 1 < w) sub[row * w + col + 1] += err * 7 / 16
      if (row + 1 < h) {
        if (col > 0) sub[(row + 1) * w + col - 1] += err * 3 / 16
        sub[(row + 1) * w + col] += err * 5 / 16
        if (col + 1 < w) sub[(row + 1) * w + col + 1] += err / 16
      }
    }
  }
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++)
      gray[(ry + row) * canvasW + (rx + col)] = sub[row * w + col]
}

function applyAtkinson(gray: Float32Array, canvasW: number, region: ImageDitherRegion): void {
  const { x: rx, y: ry, w, h, threshold } = region
  const sub = new Float32Array(w * h)
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++)
      sub[row * w + col] = gray[(ry + row) * canvasW + (rx + col)]

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const old = sub[row * w + col]
      const neu = old < threshold ? 0 : 255
      sub[row * w + col] = neu
      const err = Math.round((old - neu) / 8)
      const spread = (r: number, c: number) => {
        if (r >= 0 && r < h && c >= 0 && c < w) sub[r * w + c] += err
      }
      spread(row, col + 1)
      spread(row, col + 2)
      spread(row + 1, col - 1)
      spread(row + 1, col)
      spread(row + 1, col + 1)
      spread(row + 2, col)
    }
  }
  for (let row = 0; row < h; row++)
    for (let col = 0; col < w; col++)
      gray[(ry + row) * canvasW + (rx + col)] = sub[row * w + col]
}

function applyOrdered(gray: Float32Array, canvasW: number, region: ImageDitherRegion): void {
  const { x: rx, y: ry, w, h } = region
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const idx = (ry + row) * canvasW + (rx + col)
      const bayer = BAYER_4X4[row % 4][col % 4] / 16
      gray[idx] = (gray[idx] / 255) > bayer ? 255 : 0
    }
  }
}

export function canvasTo1BitBitmap(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  imageRegions: ImageDitherRegion[] = []
): { bitmap: Uint8Array; width: number; height: number } {
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const ctx = tmp.getContext('2d')!
  ctx.drawImage(canvas, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++)
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]

  // Per-region dithering (clamp region to canvas bounds)
  for (const region of imageRegions) {
    const rx = Math.max(0, Math.round(region.x))
    const ry = Math.max(0, Math.round(region.y))
    const rw = Math.min(w - rx, Math.round(region.w))
    const rh = Math.min(h - ry, Math.round(region.h))
    if (rw <= 0 || rh <= 0) continue
    const clamped: ImageDitherRegion = { ...region, x: rx, y: ry, w: rw, h: rh }
    if (region.algorithm === 'floyd-steinberg') applyFloydSteinberg(gray, w, clamped)
    else if (region.algorithm === 'atkinson') applyAtkinson(gray, w, clamped)
    else if (region.algorithm === 'ordered') applyOrdered(gray, w, clamped)
    // 'threshold' is handled in the global pass below using per-region threshold
  }

  // Build threshold map (default 128, overridden by threshold regions)
  const thresholdMap = new Float32Array(w * h).fill(128)
  for (const region of imageRegions.filter((r) => r.algorithm === 'threshold')) {
    const rx = Math.max(0, Math.round(region.x))
    const ry = Math.max(0, Math.round(region.y))
    const rw = Math.min(w - rx, Math.round(region.w))
    const rh = Math.min(h - ry, Math.round(region.h))
    for (let row = 0; row < rh; row++)
      for (let col = 0; col < rw; col++)
        thresholdMap[(ry + row) * w + (rx + col)] = region.threshold
  }

  const bitmap = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++)
    bitmap[i] = gray[i] < thresholdMap[i] ? 0 : 255

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
