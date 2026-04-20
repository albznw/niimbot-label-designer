export type LabelSize = '50x30' | '30x50' | '30x30'
export type LabelMode = 'canvas' | 'html'

export const LABEL_DIMS: Record<LabelSize, { w: number; h: number }> = {
  '50x30': { w: 400, h: 240 },
  '30x50': { w: 240, h: 400 },
  '30x30': { w: 240, h: 240 },
}

export const LABEL_SIZE_LABELS: Record<LabelSize, string> = {
  '50x30': '50x30mm',
  '30x50': '30x50mm',
  '30x30': '30x30mm',
}

export type LabelOrientation = 'landscape' | 'portrait'
export type LabelCornerStyle = 'rect' | 'rounded'

export interface LabelDisplaySettings {
  labelType: number
  density: number
  cornerStyle: LabelCornerStyle
  orientation: LabelOrientation
}

export const DEFAULT_LABEL_SETTINGS: LabelDisplaySettings = {
  labelType: 1,
  density: 3,
  cornerStyle: 'rect',
  orientation: 'landscape',
}

export function getCanvasDims(
  labelSize: LabelSize,
  orientation: LabelOrientation
): { w: number; h: number } {
  const base = LABEL_DIMS[labelSize]
  if (labelSize === '50x30' && orientation === 'portrait') {
    return { w: base.h, h: base.w }
  }
  return base
}
