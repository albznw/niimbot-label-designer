import { useState, useEffect, useCallback, useRef } from 'react'
import { wsClient } from './lib/ws-client'
import type { WsEvent, WsStatus } from './lib/ws-client'
import * as db from './lib/db'
import type { Template, Variable } from './types/project'
import { getProfileById, getCanvasDims } from './types/label'
import type { LabelProfile } from './types/label'
import { defaultHtmlForProfile } from './lib/defaults'
import { printerClient } from './lib/printer-client'
import type { PrinterStatus, PrintOptions } from './lib/printer-client'
import { bitmapToPngBase64 } from './lib/bitmap-utils'
import { TemplateDropdown } from './components/projects/TemplateDropdown'
import { LabelCanvas } from './components/designer/LabelCanvas'
import type { LabelCanvasHandle, NodeConfig } from './components/designer/LabelCanvas'
import { ToolSidebar } from './components/designer/ToolSidebar'
import type { Tool } from './components/designer/ToolSidebar'
import { IconModal } from './components/designer/IconModal'
import { AlignPanel } from './components/designer/AlignPanel'
import { DocAlignPanel } from './components/designer/DocAlignPanel'
import type { AlignDocDirection } from './components/designer/DocAlignPanel'
import { PropertiesPanel } from './components/designer/PropertiesPanel'
import { LayerPanel } from './components/designer/LayerPanel'
import { LabelSettings } from './components/designer/LabelSettings'
import { VariableList } from './components/designer/VariableList'
import { BitmapPreview } from './components/designer/BitmapPreview'
import { HtmlEditor } from './components/designer/HtmlEditor'
import { PrinterPanel } from './components/printer/PrinterPanel'
import { PrintDialog } from './components/printer/PrintDialog'
import { PrintHistory } from './components/history/PrintHistory'
import { WsStatusDot, SettingsPanel } from './components/settings/SettingsPanel'

export function App() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Designer state
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [printRows, setPrintRows] = useState<Record<string, string>[]>([])
  const [activePrintRow, setActivePrintRow] = useState(0)
  const [bitmap, setBitmap] = useState<Uint8Array | null>(null)
  const [bitmapDims, setBitmapDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [selectedObject, setSelectedObject] = useState<NodeConfig | NodeConfig[] | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const [editorMode, setEditorMode] = useState<'canvas' | 'html'>('canvas')
  const [modeSwitchNotice, setModeSwitchNotice] = useState<string | null>(null)
  const [canvasNodes, setCanvasNodes] = useState<NodeConfig[]>([])
  const [canvasSelectedIds, setCanvasSelectedIds] = useState<string[]>([])
  const [varPaneOpen, setVarPaneOpen] = useState(true)

  // Printer state
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>({
    connected: false,
    deviceName: null,
    type: null,
  })
  const [connecting, setConnecting] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showLabelSettings, setShowLabelSettings] = useState(false)
  const [showIconModal, setShowIconModal] = useState(false)
  const [printSuccess, setPrintSuccess] = useState<string | null>(null)

  // Backend / WS state
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')
  const [backendUrl, setBackendUrl] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const [toast, setToast] = useState<string | null>(null)

  const canvasRef = useRef<LabelCanvasHandle | null>(null)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const varSaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedTemplateIdRef = useRef(selectedTemplateId)
  useEffect(() => { selectedTemplateIdRef.current = selectedTemplateId }, [selectedTemplateId])
  const bitmapResolverRef = useRef<((bmp: Uint8Array, w: number, h: number) => void) | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Wire up disconnect callback
  useEffect(() => {
    printerClient.setDisconnectCallback(() => {
      setPrinterStatus(printerClient.getStatus())
    })
  }, [])

  // Persist selected template
  useEffect(() => {
    if (selectedTemplateId) db.setSetting('lastTemplateId', selectedTemplateId)
  }, [selectedTemplateId])

  // Init: load templates + settings, connect WS if URL configured
  useEffect(() => {
    async function init() {
      const [tpls, lastId, storedUrl] = await Promise.all([
        db.listTemplates(),
        db.getSetting('lastTemplateId'),
        db.getSetting('backendUrl'),
      ])
      setTemplates(tpls)
      if (lastId && tpls.some((t) => t.id === lastId)) setSelectedTemplateId(lastId)
      if (storedUrl) {
        setBackendUrl(storedUrl)
        connectWs(storedUrl)
      }
      setLoadingTemplates(false)
    }
    init().catch((e: unknown) =>
      setError(e instanceof Error ? e.message : 'Failed to load')
    )
    return () => wsClient.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function connectWs(url: string) {
    const wsUrl = url.replace(/^http/, 'ws') + '/ws/terminal'
    wsClient.connect(
      wsUrl,
      (event: WsEvent) => {
        if (event.type === 'queue:variables') {
          if (event.template_id !== selectedTemplateIdRef.current) {
            setSelectedTemplateId(event.template_id)
            showToast('Template switched by remote print request')
          }
          setPrintRows(event.rows)
          setActivePrintRow(0)
          setShowPrintDialog(true)
        } else if (event.type === 'queue:bitmap') {
          const binary = atob(event.bitmap_b64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          setBitmap(bytes)
          setBitmapDims({ w: event.width, h: event.height })
          setShowPrintDialog(true)
        }
      },
      setWsStatus
    )
  }

  const handleSaveBackendUrl = useCallback(async (url: string) => {
    setBackendUrl(url)
    await db.setSetting('backendUrl', url)
    if (url) {
      connectWs(url)
    } else {
      wsClient.disconnect()
    }
    setShowSettings(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset designer state when template changes
  useEffect(() => {
    setBitmap(null)
    setSelectedObject(null)
    setActiveTool('select')
    setModeSwitchNotice(null)
    setCanvasNodes([])
    setCanvasSelectedIds([])
    const rows = selectedTemplate?.print_rows ?? []
    setPrintRows(rows)
    setActivePrintRow(0)
    setVariableValues(rows[0] ?? {})
    if (selectedTemplate) {
      setEditorMode(selectedTemplate.mode ?? 'canvas')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  // Sync variableValues from active print row
  useEffect(() => {
    const row = printRows[activePrintRow] ?? printRows[0] ?? {}
    setVariableValues(row)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrintRow, printRows])

  const handleCreateTemplate = useCallback(async (
    name: string,
    presetId: string,
    mode: 'canvas' | 'html'
  ) => {
    const initialHtml = mode === 'html' ? defaultHtmlForProfile(presetId) : null
    const template = await db.createTemplate({
      name,
      label_profile: presetId,
      display_orientation: 'landscape',
      density: 3,
      corner_style: 'rect',
      mode,
      html: initialHtml,
      variables: [],
      canvas_json: null,
      print_rows: [],
      variable_text: null,
    })
    setTemplates((prev) => [...prev, template])
    setSelectedTemplateId(template.id)
  }, [])

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await db.deleteTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (selectedTemplateId === id) setSelectedTemplateId(null)
  }, [selectedTemplateId])

  const handleRenameTemplate = useCallback(async (id: string, name: string) => {
    setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name } : t))
    await db.updateTemplate(id, { name })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to rename'))
  }, [])

  const handleImportTemplate = useCallback(async (data: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => {
    const template = await db.createTemplate(data)
    setTemplates((prev) => [...prev, template])
    setSelectedTemplateId(template.id)
  }, [])

  const handleCanvasChange = useCallback((json: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, canvas_json: json } : t)
    )
    const nodes = canvasRef.current?.getNodes() ?? []
    setCanvasNodes(nodes)
    const ids = canvasRef.current?.getSelectedIds() ?? []
    setCanvasSelectedIds(ids)
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      db.updateTemplate(selectedTemplateId, { canvas_json: json })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 500)
  }, [selectedTemplateId])

  const handleHtmlChange = useCallback((html: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, html } : t)
    )
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      db.updateTemplate(selectedTemplateId, { html })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 500)
  }, [selectedTemplateId])

  const handleBitmapUpdate = useCallback((bmp: Uint8Array, w: number, h: number) => {
    setBitmap(bmp)
    setBitmapDims({ w, h })
    if (bitmapResolverRef.current) {
      bitmapResolverRef.current(bmp, w, h)
      bitmapResolverRef.current = null
    }
  }, [])

  const handleSelectionChange = useCallback((objs: NodeConfig[]) => {
    if (!objs || objs.length === 0) {
      setSelectedObject(null)
    } else if (objs.length === 1) {
      setSelectedObject(objs[0])
    } else {
      setSelectedObject(objs)
    }
    setCanvasSelectedIds(objs.map((o) => o.id))
  }, [])

  const pendingVarData = useRef<{ variables?: Variable[]; print_rows?: Record<string, string>[]; variable_text?: string }>({})

  const flushVarSave = useCallback((id: string) => {
    if (varSaveDebounceRef.current) clearTimeout(varSaveDebounceRef.current)
    varSaveDebounceRef.current = setTimeout(() => {
      const patch = pendingVarData.current
      pendingVarData.current = {}
      db.updateTemplate(id, patch)
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 500)
  }, [])

  const handleVariablesChange = useCallback((vars: Variable[]) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, variables: vars } : t)
    )
    pendingVarData.current.variables = vars
    flushVarSave(selectedTemplateId)
  }, [selectedTemplateId, flushVarSave])

  const handleVariableTextChange = useCallback((text: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, variable_text: text } : t)
    )
    pendingVarData.current.variable_text = text
    flushVarSave(selectedTemplateId)
  }, [selectedTemplateId, flushVarSave])

  const handlePrintRowsChange = useCallback((rows: Record<string, string>[]) => {
    if (!selectedTemplateId) return
    setPrintRows(rows)
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, print_rows: rows } : t)
    )
    pendingVarData.current.print_rows = rows
    flushVarSave(selectedTemplateId)
  }, [selectedTemplateId, flushVarSave])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null
  const labelProfile: LabelProfile | null = selectedTemplate ? getProfileById(selectedTemplate.label_profile) : null
  const dims = labelProfile && selectedTemplate
    ? getCanvasDims(labelProfile, selectedTemplate.display_orientation)
    : { w: 0, h: 0 }

  const handleProfileChange = useCallback(async (presetId: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, label_profile: presetId } : t)
    )
    await db.updateTemplate(selectedTemplateId, { label_profile: presetId })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
  }, [selectedTemplateId])

  const handleProjectSettingsChange = useCallback(async (
    patch: Partial<Pick<Template, 'display_orientation' | 'density' | 'corner_style'>>
  ) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, ...patch } : t)
    )
    await db.updateTemplate(selectedTemplateId, patch)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
  }, [selectedTemplateId])

  const handleSwitchMode = useCallback(() => {
    if (!selectedTemplateId || !selectedTemplate) return
    const nextMode = editorMode === 'canvas' ? 'html' : 'canvas'
    const notice = nextMode === 'html'
      ? 'Switching to HTML mode will not carry over canvas elements.'
      : 'Switching to Canvas mode will not carry over HTML content.'
    setModeSwitchNotice(notice)
    setEditorMode(nextMode)
    setBitmap(null)
    db.updateTemplate(selectedTemplateId, { mode: nextMode })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save mode'))
    setTimeout(() => setModeSwitchNotice(null), 4000)
  }, [editorMode, selectedTemplateId, selectedTemplate])

  // Printer handlers
  const handleConnectBLE = useCallback(async () => {
    setConnecting(true)
    try {
      await printerClient.connectBluetooth()
      setPrinterStatus(printerClient.getStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BLE connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const handleConnectSerial = useCallback(async () => {
    setConnecting(true)
    try {
      await printerClient.connectSerial()
      setPrinterStatus(printerClient.getStatus())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Serial connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    await printerClient.disconnect()
    setPrinterStatus(printerClient.getStatus())
  }, [])

  const handlePrint = useCallback(async (
    printVariables: Record<string, string>,
    options: PrintOptions
  ) => {
    if (!bitmap || !selectedTemplate) return

    const w = bitmapDims.w || dims.w
    const h = bitmapDims.h || dims.h
    const printerName = printerStatus.deviceName ?? 'Unknown'

    let printError: string | undefined
    try {
      await printerClient.print(bitmap, w, h, options)
    } catch (e) {
      printError = e instanceof Error ? e.message : 'Print failed'
      throw e
    } finally {
      try {
        const pngB64 = await bitmapToPngBase64(bitmap, w, h)
        await db.savePrintJob({
          template_id: selectedTemplate.id,
          variables_used: printVariables,
          bitmap_png_b64: pngB64,
          printer_name: printerName,
          printed_at: new Date().toISOString(),
          success: printError === undefined,
          error: printError ?? null,
        })
      } catch {
        // history save failure is non-fatal
      }
    }

    setShowPrintDialog(false)
    setPrintSuccess(`Printed ${options.quantity}x on ${printerName}`)
    setTimeout(() => setPrintSuccess(null), 4000)
  }, [bitmap, bitmapDims, selectedTemplate, printerStatus, dims])

  const handleBatchPrint = useCallback(async (
    rows: Record<string, string>[],
    options: PrintOptions
  ) => {
    if (!selectedTemplate) return
    const w = bitmapDims.w || dims.w
    const h = bitmapDims.h || dims.h
    const printerName = printerStatus.deviceName ?? 'Unknown'

    for (const row of rows) {
      const values = row

      setVariableValues(values)

      const { bmp, bw, bh } = await new Promise<{ bmp: Uint8Array; bw: number; bh: number }>((resolve) => {
        bitmapResolverRef.current = (b, bw, bh) => resolve({ bmp: b, bw, bh })
        setTimeout(() => {
          if (bitmapResolverRef.current) {
            bitmapResolverRef.current = null
            resolve({ bmp: bitmap!, bw: w, bh: h })
          }
        }, 500)
      })

      try {
        await printerClient.print(bmp, bw, bh, { ...options, quantity: 1 })
        await db.savePrintJob({
          template_id: selectedTemplate.id,
          variables_used: values,
          bitmap_png_b64: await bitmapToPngBase64(bmp, bw, bh),
          printer_name: printerName,
          printed_at: new Date().toISOString(),
          success: true,
          error: null,
        })
      } catch (e) {
        try {
          await db.savePrintJob({
            template_id: selectedTemplate.id,
            variables_used: values,
            bitmap_png_b64: null,
            printer_name: printerName,
            printed_at: new Date().toISOString(),
            success: false,
            error: e instanceof Error ? e.message : 'Print failed',
          })
        } catch { /* non-fatal */ }
        throw e
      }
    }

    setShowPrintDialog(false)
    setPrintSuccess(`Printed ${rows.length} labels on ${printerName}`)
    setTimeout(() => setPrintSuccess(null), 4000)
  }, [selectedTemplate, bitmapDims, dims, printerStatus, bitmap])

  // Intercept 'icon' tool: open modal and revert tool to 'select'
  useEffect(() => {
    if (activeTool === 'icon') {
      setShowIconModal(true)
      setActiveTool('select')
    }
  }, [activeTool])

  const hasSelection = selectedObject != null
  const multiSelected = Array.isArray(selectedObject) && selectedObject.length >= 2

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editorMode !== 'canvas') return
      if (!selectedTemplate) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      const isEditable = document.activeElement?.hasAttribute('contenteditable') === true
      if (['input', 'textarea', 'select'].includes(tag) || isEditable) return

      const key = e.key.toLowerCase()

      if (key === 'v' || e.key === 'Escape') {
        setActiveTool('select')
        e.preventDefault()
      } else if (key === 't') {
        setActiveTool('text')
        e.preventDefault()
      } else if (key === 'r') {
        setActiveTool('rect')
        e.preventDefault()
      } else if (key === 'c') {
        setActiveTool('circle')
        e.preventDefault()
      } else if (key === 'l') {
        setActiveTool('line')
        e.preventDefault()
      } else if (key === 'q') {
        setActiveTool('qr')
        e.preventDefault()
      } else if (key === 'b') {
        setActiveTool('barcode')
        e.preventDefault()
      } else if (key === 'i') {
        canvasRef.current?.triggerImageUpload()
        e.preventDefault()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection) {
        canvasRef.current?.deleteSelected()
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editorMode, selectedTemplate, hasSelection])

  const handleIconSelect = useCallback((filename: string) => {
    canvasRef.current?.addImage('/icons/' + filename)
    setShowIconModal(false)
  }, [])


  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-white overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-5 py-3 border-b border-white/10 bg-[#2a2a2a] shrink-0">
        <h1 className="text-sm font-semibold tracking-wide">Niimbot Label Designer</h1>
        <span className="text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">M4</span>
        <TemplateDropdown
          templates={templates}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={setSelectedTemplateId}
          onCreate={handleCreateTemplate}
          onDelete={handleDeleteTemplate}
          onRename={handleRenameTemplate}
          onImport={handleImportTemplate}
          loading={loadingTemplates}
        />
        <div className="flex-1" />
        <WsStatusDot status={wsStatus} onClick={() => setShowSettings(true)} />
        <PrinterPanel
          status={printerStatus}
          connecting={connecting}
          onConnectBLE={handleConnectBLE}
          onConnectSerial={handleConnectSerial}
          onDisconnect={handleDisconnect}
        />
        {selectedTemplate && (
          <button
            onClick={() => setShowLabelSettings(true)}
            className="text-xs px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded transition-colors border border-white/10"
          >
            Label Settings
          </button>
        )}
        <button
          onClick={() => setShowHistory(true)}
          className="text-xs px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded transition-colors border border-white/10"
        >
          History
        </button>
        {error && (
          <span className="text-xs text-red-400 bg-red-900/20 px-2 py-0.5 rounded">
            {error}
            <button className="ml-2 text-red-300 hover:text-white" onClick={() => setError(null)}>×</button>
          </span>
        )}
        {printSuccess && (
          <span className="text-xs text-green-400 bg-green-900/20 px-2 py-0.5 rounded">
            {printSuccess}
          </span>
        )}
        {toast && (
          <span className="text-xs text-blue-300 bg-blue-900/20 px-2 py-0.5 rounded animate-pulse">
            {toast}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {!selectedTemplate ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a template to open the designer</p>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {editorMode === 'canvas' && (
                <ToolSidebar
                  activeTool={activeTool}
                  onToolChange={setActiveTool}
                  hasSelection={hasSelection}
                  onDelete={() => canvasRef.current?.deleteSelected()}
                  onImageUpload={() => canvasRef.current?.triggerImageUpload()}
                />
              )}
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Mode toggle + print toolbar */}
                <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/10 bg-[#252525] shrink-0">
                  <span className="text-xs text-gray-400">Mode:</span>
                  <button
                    onClick={handleSwitchMode}
                    className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                      editorMode === 'canvas'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                    }`}
                  >
                    Canvas
                  </button>
                  <button
                    onClick={handleSwitchMode}
                    className={`text-xs px-2.5 py-1 rounded font-mono transition-colors ${
                      editorMode === 'html'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#333] text-gray-300 hover:bg-[#444]'
                    }`}
                  >
                    HTML
                  </button>
                  {modeSwitchNotice && (
                    <span className="text-xs text-yellow-400/80 ml-2">{modeSwitchNotice}</span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => setShowPrintDialog(true)}
                    disabled={!bitmap}
                    className="text-xs px-3 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed rounded transition-colors font-medium"
                  >
                    Print
                  </button>
                </div>

                {editorMode === 'canvas' ? (
                  <LabelCanvas
                    ref={canvasRef}
                    template={selectedTemplate}
                    variableValues={variableValues}
                    activeTool={activeTool}
                    labelProfile={labelProfile!}
                    displayOrientation={selectedTemplate.display_orientation}
                    onCanvasChange={handleCanvasChange}
                    onBitmapUpdate={handleBitmapUpdate}
                    onSelectionChange={handleSelectionChange}
                    onToolUsed={() => setActiveTool('select')}
                  />
                ) : (
                  <HtmlEditor
                    html={selectedTemplate.html ?? defaultHtmlForProfile(selectedTemplate.label_profile)}
                    profileId={selectedTemplate.label_profile}
                    variableValues={variableValues}
                    onChange={handleHtmlChange}
                    onBitmapUpdate={handleBitmapUpdate}
                  />
                )}

                {/* Variable pane */}
                <div className="border-t border-white/10 shrink-0">
                  <button
                    onClick={() => setVarPaneOpen(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-1 bg-[#222] hover:bg-[#2a2a2a] transition-colors text-xs text-gray-500"
                  >
                    <span>{varPaneOpen ? '▼' : '▶'}</span>
                    <span>Variables</span>
                  </button>
                  {varPaneOpen && (
                    <VariableList
                      variables={selectedTemplate.variables}
                      values={variableValues}
                      onChange={handleVariablesChange}
                      onValuesChange={setVariableValues}
                      onTextChange={handleVariableTextChange}
                      initialText={selectedTemplate.variable_text ?? ''}
                      printRows={printRows}
                      activePrintRow={activePrintRow}
                      onPrintRowsChange={handlePrintRowsChange}
                      onActivePrintRowChange={setActivePrintRow}
                      syncKey={selectedTemplate.id}
                    />
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="w-[280px] shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-[#2a2a2a]">
                <BitmapPreview
                  bitmap={bitmap}
                  width={bitmapDims.w || dims.w}
                  height={bitmapDims.h || dims.h}
                  labelProfile={labelProfile!}
                  displayOrientation={selectedTemplate.display_orientation}
                  cornerStyle={selectedTemplate.corner_style}
                  printCount={printRows.length > 0 ? printRows.length : 1}
                  activePrintRow={activePrintRow}
                />
                {editorMode === 'canvas' && (
                  <>
                    <div className="flex-1 overflow-y-auto">
                      {multiSelected && (
                        <AlignPanel
                          onAlign={(dir) => canvasRef.current?.alignSelected(dir)}
                          onDistribute={(dir) => canvasRef.current?.distributeSelected(dir)}
                        />
                      )}
                      <PropertiesPanel
                        selectedObject={selectedObject}
                        onUpdate={(patch) => canvasRef.current?.updateSelected(patch)}
                      />
                      {hasSelection && (
                        <DocAlignPanel onAlign={(dir: AlignDocDirection) => canvasRef.current?.alignToDocument(dir)} />
                      )}
                      <LayerPanel
                        nodes={canvasNodes}
                        selectedIds={canvasSelectedIds}
                        onSelect={(id) => canvasRef.current?.selectNode(id)}
                        onReorder={(from, to) => canvasRef.current?.reorderNodes(from, to)}
                        onMoveToFront={(id) => canvasRef.current?.moveToFront(id)}
                        onMoveToBack={(id) => canvasRef.current?.moveToBack(id)}
                        onMoveForward={(id) => canvasRef.current?.moveForward(id)}
                        onMoveBackward={(id) => canvasRef.current?.moveBackward(id)}
                      />
                    </div>
                  </>
                )}
                {editorMode === 'html' && <div className="flex-1" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showPrintDialog && selectedTemplate && (
        <PrintDialog
          template={selectedTemplate}
          currentBitmap={bitmap}
          bitmapWidth={bitmapDims.w || dims.w}
          bitmapHeight={bitmapDims.h || dims.h}
          printerStatus={printerStatus}
          labelProfile={labelProfile!}
          printRows={printRows}
          onPrint={handlePrint}
          onBatchPrint={handleBatchPrint}
          onClose={() => setShowPrintDialog(false)}
        />
      )}

      {showHistory && <PrintHistory onClose={() => setShowHistory(false)} />}

      {showIconModal && (
        <IconModal
          onSelect={handleIconSelect}
          onClose={() => setShowIconModal(false)}
        />
      )}

      {showLabelSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowLabelSettings(false)}>
          <div className="bg-[#2a2a2a] border border-white/10 rounded-lg w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold">Label Settings</h2>
              <button onClick={() => setShowLabelSettings(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
            </div>
            <LabelSettings
              labelProfile={labelProfile!}
              displayOrientation={selectedTemplate!.display_orientation}
              density={selectedTemplate!.density}
              cornerStyle={selectedTemplate!.corner_style}
              onProfileChange={handleProfileChange}
              onChange={handleProjectSettingsChange}
            />
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsPanel
          backendUrl={backendUrl}
          wsStatus={wsStatus}
          onSave={handleSaveBackendUrl}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
