import type { LabelCornerStyle, LabelDisplayOrientation } from './label'

export interface Variable {
  name: string
  type: 'text' | 'number' | 'url'
  default: string
}

export interface Template {
  id: string
  name: string
  mode: 'canvas' | 'html'
  canvas_json: string | null
  html: string | null
  variables: Variable[]
  label_profile: string
  display_orientation: LabelDisplayOrientation
  corner_style: LabelCornerStyle
  density: number
  print_rows: Record<string, string>[]
  variable_text: string | null
  created_at: string
  updated_at: string
}
