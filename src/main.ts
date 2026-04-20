import * as monaco from 'monaco-editor'
import {
  loadTemplates, saveTemplates, createTemplate, DEFAULT_TS,
  type Template, type LabelSize, type SubLabel,
} from './templates'
import {
  connectPrinter, disconnectPrinter, isConnected, printLabel, captureLabel, LABEL_DIMS,
} from './printer'

// --- State ---
let templates = loadTemplates().map(t => ({ ...t, ts: t.ts || DEFAULT_TS }))
let activeId = templates[0]?.id ?? ''
let htmlEditor: monaco.editor.IStandaloneCodeEditor
let tsEditor: monaco.editor.IStandaloneCodeEditor
let suppressEditorChange = false

// --- DOM ---
const $  = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const templatePicker = $<HTMLSelectElement>('template-picker')
const newBtn         = $<HTMLButtonElement>('new-btn')
const renameBtn      = $<HTMLButtonElement>('rename-btn')
const deleteBtn      = $<HTMLButtonElement>('delete-btn')
const labelSizeEl    = $<HTMLSelectElement>('label-size')
const subLabelEl     = $<HTMLSelectElement>('sub-label')
const btDot          = $<HTMLElement>('bt-dot')
const btText         = $<HTMLElement>('bt-text')
const connectBtn     = $<HTMLButtonElement>('connect-btn')
const printBtn       = $<HTMLButtonElement>('print-btn')
const previewCanvas  = $<HTMLCanvasElement>('preview-canvas')
const labelFrame     = $<HTMLElement>('label-frame')
const previewInfo    = $<HTMLElement>('preview-info')
const messages       = $<HTMLElement>('messages')

// --- Messages ---
function log(text: string, type: 'info' | 'ok' | 'error' = 'info'): void {
  const el = document.createElement('div')
  el.className = `msg ${type}`
  el.textContent = text
  messages.prepend(el)
  if (messages.children.length > 6) messages.lastElementChild?.remove()
}

// --- Template helpers ---
function getActive(): Template | undefined {
  return templates.find(t => t.id === activeId)
}

function save(): void {
  saveTemplates(templates)
}

function rebuildPicker(): void {
  templatePicker.innerHTML = ''
  for (const t of templates) {
    const opt = document.createElement('option')
    opt.value = t.id
    opt.textContent = t.name
    if (t.id === activeId) opt.selected = true
    templatePicker.appendChild(opt)
  }
}

// --- TS compilation ---
async function compileTs(code: string): Promise<string> {
  if (!code.trim()) return ''
  const uri = tsEditor.getModel()!.uri
  const getWorker = await monaco.languages.typescript.getTypeScriptWorker()
  const client = await getWorker(uri)
  const result = await client.getEmitOutput(uri.toString())
  return result.outputFiles.find((f: { name: string }) => f.name.endsWith('.js'))?.text ?? ''
}

// --- Preview ---
const PREVIEW_MAX = 300

function applyCanvasCSS(w: number, h: number): void {
  const scale = Math.min(PREVIEW_MAX / w, PREVIEW_MAX / h)
  const dw = Math.round(w * scale)
  const dh = Math.round(h * scale)
  labelFrame.style.width  = `${dw}px`
  labelFrame.style.height = `${dh}px`
  previewCanvas.style.width  = `${dw}px`
  previewCanvas.style.height = `${dh}px`
}

let previewDebounce: ReturnType<typeof setTimeout>
function schedulePreview(): void {
  clearTimeout(previewDebounce)
  previewDebounce = setTimeout(async () => {
    const t = getActive()
    if (!t) return
    try {
      const js = await compileTs(t.ts)
      const canvas = await captureLabel(t.html, t.labelSize, t.subLabel, js)
      previewCanvas.width  = canvas.width
      previewCanvas.height = canvas.height
      previewCanvas.getContext('2d')!.drawImage(canvas, 0, 0)
      applyCanvasCSS(canvas.width, canvas.height)
      const { w, h } = LABEL_DIMS[t.labelSize]
      const printH = t.labelSize === '30x30' ? 120 : h
      previewInfo.textContent = `${w}×${printH} px · 203 DPI · ${t.labelSize} mm`
    } catch (e) {
      log(`Preview failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
    }
  }, 400)
}

// --- Activate template ---
function setEditorValue(editor: monaco.editor.IStandaloneCodeEditor, value: string): void {
  if (editor.getValue() === value) return
  suppressEditorChange = true
  editor.setValue(value)
  editor.setScrollPosition({ scrollTop: 0 })
  suppressEditorChange = false
}

function activate(id: string): void {
  activeId = id
  const t = getActive()
  if (!t) return

  templatePicker.value = t.id
  labelSizeEl.value    = t.labelSize
  subLabelEl.value     = t.subLabel
  subLabelEl.classList.toggle('hidden', t.labelSize !== '30x30')

  setEditorValue(htmlEditor, t.html)
  setEditorValue(tsEditor, t.ts)
  schedulePreview()
}

// --- Printer status ---
type DotState = 'off' | 'busy' | 'on'

function setStatus(state: DotState, text: string): void {
  btDot.className = state === 'off' ? 'dot' : `dot ${state}`
  btText.textContent = text
  printBtn.disabled = state !== 'on'
}

// --- Init ---
function init(): void {
  const editorDefaults: monaco.editor.IStandaloneEditorConstructionOptions = {
    theme: 'vs-dark',
    minimap: { enabled: false },
    fontSize: 13,
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'gutter',
    tabSize: 2,
    insertSpaces: true,
  }

  htmlEditor = monaco.editor.create($('html-editor-container'), {
    ...editorDefaults,
    value: '',
    language: 'html',
  })

  const tsModel = monaco.editor.createModel(
    '',
    'typescript',
    monaco.Uri.parse('file:///label.ts'),
  )
  tsEditor = monaco.editor.create($('ts-editor-container'), {
    ...editorDefaults,
    model: tsModel,
  })

  htmlEditor.onDidChangeModelContent(() => {
    if (suppressEditorChange) return
    const t = getActive()
    if (!t) return
    t.html = htmlEditor.getValue()
    save()
    schedulePreview()
  })

  tsEditor.onDidChangeModelContent(() => {
    if (suppressEditorChange) return
    const t = getActive()
    if (!t) return
    t.ts = tsEditor.getValue()
    save()
    schedulePreview()
  })

  // Layout toggle
  const split = $('editor-split')
  const layoutBtn = $<HTMLButtonElement>('layout-btn')
  layoutBtn.addEventListener('click', () => {
    split.classList.toggle('horizontal')
    layoutBtn.textContent = split.classList.contains('horizontal') ? '⇄' : '⇅'
    htmlEditor.layout()
    tsEditor.layout()
  })

  // Resize handle
  const handle = $('resize-handle')
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const isHoriz = split.classList.contains('horizontal')
    const htmlHost = $('html-editor-host')
    const rect = split.getBoundingClientRect()
    const startPos = isHoriz ? e.clientX : e.clientY
    const startSize = isHoriz
      ? htmlHost.getBoundingClientRect().width
      : htmlHost.getBoundingClientRect().height
    const totalSize = isHoriz ? rect.width : rect.height

    const onMove = (ev: MouseEvent) => {
      const delta = (isHoriz ? ev.clientX : ev.clientY) - startPos
      const pct = Math.min(80, Math.max(20, ((startSize + delta) / totalSize) * 100))
      htmlHost.style.flex = `0 0 ${pct}%`
      htmlEditor.layout()
      tsEditor.layout()
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  rebuildPicker()
  activate(templates[0]?.id ?? '')

  templatePicker.addEventListener('change', () => activate(templatePicker.value))

  newBtn.addEventListener('click', () => {
    const name = prompt('Template name:')?.trim()
    if (!name) return
    const size = (labelSizeEl.value || '50x30') as LabelSize
    const t = createTemplate(name, size)
    templates.push(t)
    save()
    rebuildPicker()
    activate(t.id)
  })

  renameBtn.addEventListener('click', () => {
    const t = getActive()
    if (!t) return
    const name = prompt('New name:', t.name)?.trim()
    if (!name) return
    t.name = name
    save()
    rebuildPicker()
  })

  deleteBtn.addEventListener('click', () => {
    const t = getActive()
    if (!t || templates.length <= 1) return
    if (!confirm(`Delete "${t.name}"?`)) return
    templates = templates.filter(x => x.id !== t.id)
    save()
    rebuildPicker()
    activate(templates[0].id)
  })

  labelSizeEl.addEventListener('change', () => {
    const t = getActive()
    if (!t) return
    t.labelSize = labelSizeEl.value as LabelSize
    subLabelEl.classList.toggle('hidden', t.labelSize !== '30x30')
    save()
    schedulePreview()
  })

  subLabelEl.addEventListener('change', () => {
    const t = getActive()
    if (!t) return
    t.subLabel = subLabelEl.value as SubLabel
    save()
    schedulePreview()
  })

  connectBtn.addEventListener('click', async () => {
    if (isConnected()) {
      await disconnectPrinter()
      setStatus('off', 'Not connected')
      connectBtn.textContent = 'Connect B1'
      return
    }
    setStatus('busy', 'Connecting...')
    connectBtn.disabled = true
    try {
      const name = await connectPrinter(() => {
        setStatus('off', 'Disconnected')
        connectBtn.textContent = 'Connect B1'
        connectBtn.disabled = false
        log('Printer disconnected', 'error')
      })
      setStatus('on', name)
      connectBtn.textContent = 'Disconnect'
      log(`Connected: ${name}`, 'ok')
    } catch (e) {
      setStatus('off', 'Not connected')
      log(`Connect failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      connectBtn.disabled = false
    }
  })

  printBtn.addEventListener('click', async () => {
    const t = getActive()
    if (!t) return
    printBtn.disabled = true
    log('Printing...', 'info')
    try {
      const js = await compileTs(t.ts)
      await printLabel(t.html, t.labelSize, t.subLabel, js)
      log('Print sent', 'ok')
    } catch (e) {
      log(`Print failed: ${e instanceof Error ? e.message : String(e)}`, 'error')
    } finally {
      printBtn.disabled = !isConnected()
    }
  })
}

init()
