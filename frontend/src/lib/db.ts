import type { Template } from '../types/project'

const DB_NAME = 'niimbot-designer'
const DB_VERSION = 4

export interface PrintJobRecord {
  id: string
  template_id: string
  printed_at: string
  variables_used: Record<string, string>
  bitmap_png_b64: string | null
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

function genId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function mapLabelSizeToProfileId(labelSize: string | undefined): string {
  switch (labelSize) {
    case '50x30': return 'simple-50x30'
    case '30x50': return 'simple-50x30'
    case '30x30': return 'double-30x15'
    default:      return 'simple-50x30'
  }
}

function stripCornerSuffix(presetId: string): string {
  return presetId.replace(/-(rect|rounded)$/, '')
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      const oldVersion = e.oldVersion

      if (!db.objectStoreNames.contains('templates')) {
        db.createObjectStore('templates', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('print_history')) {
        const hs = db.createObjectStore('print_history', { keyPath: 'id' })
        hs.createIndex('printed_at', 'printed_at', { unique: false })
      }

      const tx = (e.target as IDBOpenDBRequest).transaction
      if (!tx) return

      // v1 → v2: migrate label_size to preset_id, add display_orientation and density
      if (oldVersion < 2) {
        const store = tx.objectStore('templates')
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = (ce) => {
          const cursor = (ce.target as IDBRequest<IDBCursorWithValue>).result
          if (!cursor) return
          const record = cursor.value as Record<string, unknown>
          let dirty = false

          if (!('preset_id' in record) || record['preset_id'] == null) {
            record["preset_id"] = mapLabelSizeToProfileId(record['label_size'] as string | undefined)
            dirty = true
          }
          if (!('display_orientation' in record) || record['display_orientation'] == null) {
            record['display_orientation'] = 'landscape'
            dirty = true
          }
          if (!('density' in record) || record['density'] == null) {
            record['density'] = 3
            dirty = true
          }

          if (dirty) cursor.update(record)
          cursor.continue()
        }
      }

      // v2 → v3: add corner_style, strip -rect/-rounded suffix from preset_id
      if (oldVersion < 3) {
        const store = tx.objectStore('templates')
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = (ce) => {
          const cursor = (ce.target as IDBRequest<IDBCursorWithValue>).result
          if (!cursor) return
          const record = cursor.value as Record<string, unknown>
          let dirty = false

          if (!('corner_style' in record) || record['corner_style'] == null) {
            record['corner_style'] = 'rect'
            dirty = true
          }
          if (typeof record['preset_id'] === 'string' && /-(rect|rounded)$/.test(record['preset_id'])) {
            record['preset_id'] = stripCornerSuffix(record['preset_id'])
            dirty = true
          }

          if (dirty) cursor.update(record)
          cursor.continue()
        }
      }

      // v3 → v4: rename preset_id to label_profile
      if (oldVersion < 4) {
        const store = tx.objectStore('templates')
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = (ce) => {
          const cursor = (ce.target as IDBRequest<IDBCursorWithValue>).result
          if (!cursor) return
          const record = cursor.value as Record<string, unknown>
          if ('preset_id' in record) {
            record['label_profile'] = record['preset_id']
            delete record['preset_id']
            cursor.update(record)
          }
          cursor.continue()
        }
      }
    }
  })
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode)
        const store = t.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

// Templates
export async function listTemplates(): Promise<Template[]> {
  return tx<Template[]>('templates', 'readonly', (store) => store.getAll())
}

export async function getTemplate(id: string): Promise<Template | null> {
  const result = await tx<Template | undefined>('templates', 'readonly', (store) => store.get(id))
  return result ?? null
}

export async function createTemplate(
  data: Omit<Template, 'id' | 'created_at' | 'updated_at'>
): Promise<Template> {
  const now = new Date().toISOString()
  const template: Template = { ...data, id: genId(), created_at: now, updated_at: now }
  await tx('templates', 'readwrite', (store) => store.put(template))
  return template
}

export async function updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
  const existing = await getTemplate(id)
  if (!existing) throw new Error(`Template ${id} not found`)
  const updated: Template = { ...existing, ...data, id, updated_at: new Date().toISOString() }
  await tx('templates', 'readwrite', (store) => store.put(updated))
  return updated
}

export async function deleteTemplate(id: string): Promise<void> {
  await tx<undefined>('templates', 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>)
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const result = await tx<{ key: string; value: string } | undefined>(
    'settings',
    'readonly',
    (store) => store.get(key)
  )
  return result?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await tx('settings', 'readwrite', (store) => store.put({ key, value }))
}

// Print history
export async function savePrintJob(data: Omit<PrintJobRecord, 'id'>): Promise<PrintJobRecord> {
  const job: PrintJobRecord = { ...data, id: genId() }
  await tx('print_history', 'readwrite', (store) => store.put(job))
  return job
}

export async function getPrintHistory(page = 1, perPage = 20): Promise<PrintHistoryResponse> {
  const all = await tx<PrintJobRecord[]>('print_history', 'readonly', (store) => store.getAll())
  all.sort((a, b) => b.printed_at.localeCompare(a.printed_at))
  const total = all.length
  const items = all.slice((page - 1) * perPage, page * perPage)
  return { items, total, page, per_page: perPage }
}

export function getBitmapDataUrl(job: PrintJobRecord): string | null {
  if (!job.bitmap_png_b64) return null
  return `data:image/png;base64,${job.bitmap_png_b64}`
}
