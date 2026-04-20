import type { LabelSize } from './label'

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
  label_size: LabelSize
  sub_label: 'top' | 'bottom'
  print_rows: Record<string, string>[]
  variable_text: string | null
  created_at: string
  updated_at: string
}
