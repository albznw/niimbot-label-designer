export type LabelType = 'simple' | 'double' | 'cable'
export type LabelCornerStyle = 'rect' | 'rounded'
export type LabelPrintDirection = 'top' | 'left'
export type LabelDisplayOrientation = 'landscape' | 'portrait'
export type LabelMode = 'canvas' | 'html'

export interface LabelProfile {
  id: string
  name: string
  type: LabelType
  canvasSize: { w: number; h: number }  // canonical pixel dims (landscape)
  labelType: number  // printer media type number
  printDirection: LabelPrintDirection
}

export const LABEL_PROFILES: LabelProfile[] = [
  { id: 'simple-50x30', name: '50×30mm',       type: 'simple', canvasSize: { w: 400, h: 240 }, labelType: 1, printDirection: 'top'  },
  { id: 'double-30x15', name: '2× 30×15mm',    type: 'double', canvasSize: { w: 240, h: 240 }, labelType: 1, printDirection: 'top'  },
  { id: 'cable-40x30',  name: 'Cable 40×30mm', type: 'cable',  canvasSize: { w: 640, h: 240 }, labelType: 1, printDirection: 'left' },
]

export const DEFAULT_PROFILE_ID = 'simple-50x30'

export function getProfileById(id: string): LabelProfile {
  return LABEL_PROFILES.find((p) => p.id === id) ?? LABEL_PROFILES[0]
}

export function getCanvasDims(
  preset: LabelProfile,
  displayOrientation: LabelDisplayOrientation
): { w: number; h: number } {
  const { w, h } = preset.canvasSize
  if (displayOrientation === 'portrait' && w !== h) {
    return { w: h, h: w }
  }
  return { w, h }
}

export function getEffectivePrintDirection(
  preset: LabelProfile,
  displayOrientation: LabelDisplayOrientation
): LabelPrintDirection {
  if (displayOrientation === 'portrait') {
    return preset.printDirection === 'top' ? 'left' : 'top'
  }
  return preset.printDirection
}
