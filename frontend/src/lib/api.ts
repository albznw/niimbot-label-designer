import type { Template } from '../types/project'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      const detail = body.detail ?? body.message ?? message
      message = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(', ')
        : String(detail)
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// Normalize template: backend stores variables as JSON string, frontend needs array
function normalizeTemplate(t: Template): Template {
  return {
    ...t,
    variables: typeof t.variables === 'string' ? JSON.parse(t.variables as unknown as string) : (t.variables ?? []),
  }
}

// Serialize template data for backend: variables array → JSON string
function serializeTemplate(data: Partial<Template>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data }
  if (Array.isArray(data.variables)) {
    out.variables = JSON.stringify(data.variables)
  }
  return out
}

// Templates
export async function listTemplates(): Promise<Template[]> {
  const templates = await request<Template[]>('/templates')
  return templates.map(normalizeTemplate)
}

export async function createTemplate(data: Partial<Template>): Promise<Template> {
  const t = await request<Template>('/templates', {
    method: 'POST',
    body: JSON.stringify(serializeTemplate(data)),
  })
  return normalizeTemplate(t)
}

export async function updateTemplate(
  templateId: string,
  data: Partial<Template>
): Promise<Template> {
  const t = await request<Template>(`/templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(serializeTemplate(data)),
  })
  return normalizeTemplate(t)
}

export function deleteTemplate(templateId: string): Promise<void> {
  return request<void>(`/templates/${templateId}`, { method: 'DELETE' })
}

// Print history
export interface PrintJobRecord {
  id: string
  template_id: string
  printed_at: string
  variables_used: Record<string, string>
  bitmap_path: string | null
  printer_name: string
  success: boolean
  error: string | null
}

export interface PrintHistoryResponse {
  items: PrintJobRecord[]
  total: number
  page: number
  per_page: number
}

export function savePrintJob(data: {
  template_id: string
  variables: Record<string, string>
  bitmap_png_b64: string
  printer_name: string
  success: boolean
  error?: string
}): Promise<{ job_id: string; success: boolean }> {
  return request<{ job_id: string; success: boolean }>('/print', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getPrintHistory(page = 1): Promise<PrintHistoryResponse> {
  return request<PrintHistoryResponse>(`/history?page=${page}`)
}

export function getBitmapUrl(jobId: string): string {
  return `/api/history/${jobId}/bitmap`
}
