import { useState, useEffect, useCallback, useRef } from 'react'
import type { Template, Variable } from './types/project'
import type { LabelSize, LabelDisplaySettings } from './types/label'
import { getCanvasDims, DEFAULT_LABEL_SETTINGS } from './types/label'
import * as api from './lib/api'
import { defaultHtmlForSize } from './lib/defaults'
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
  const [labelSettings, setLabelSettings] = useState<LabelDisplaySettings>(
    DEFAULT_LABEL_SETTINGS
  )

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

  const canvasRef = useRef<LabelCanvasHandle | null>(null)
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wire up disconnect callback
  useEffect(() => {
    printerClient.setDisconnectCallback(() => {
      setPrinterStatus(printerClient.getStatus())
    })
  }, [])

  // Load templates on mount
  useEffect(() => {
    api.listTemplates()
      .then(setTemplates)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoadingTemplates(false))
  }, [])

  // Reset designer state when template changes
  useEffect(() => {
    setBitmap(null)
    setSelectedObject(null)
    setActiveTool('select')
    setModeSwitchNotice(null)
    setCanvasNodes([])
    setCanvasSelectedIds([])
    setLabelSettings(DEFAULT_LABEL_SETTINGS)
    setPrintRows([])
    setActivePrintRow(0)
    if (selectedTemplate) {
      const defaults: Record<string, string> = {}
      selectedTemplate.variables.forEach((v) => { defaults[v.name] = v.default })
      setVariableValues(defaults)
      setEditorMode(selectedTemplate.mode ?? 'canvas')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId])

  // Sync variableValues from active print row when batch mode is active
  useEffect(() => {
    if (printRows.length === 0) return
    const row = printRows[activePrintRow] ?? {}
    const defaults: Record<string, string> = {}
    if (selectedTemplate) {
      selectedTemplate.variables.forEach((v) => { defaults[v.name] = v.default })
    }
    setVariableValues({ ...defaults, ...row })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrintRow, printRows])

  const handleCreateTemplate = useCallback(async (
    name: string,
    labelSize: LabelSize,
    mode: 'canvas' | 'html'
  ) => {
    const initialHtml = mode === 'html' ? defaultHtmlForSize(labelSize) : null
    const template = await api.createTemplate({
      name,
      label_size: labelSize,
      mode,
      html: initialHtml,
      variables: [],
      sub_label: 'bottom',
    })
    setTemplates((prev) => [...prev, template])
    setSelectedTemplateId(template.id)
  }, [])

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await api.deleteTemplate(id)
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    if (selectedTemplateId === id) setSelectedTemplateId(null)
  }, [selectedTemplateId])

  const handleCanvasChange = useCallback((json: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId ? { ...t, canvas_json: json } : t
      )
    )
    const nodes = canvasRef.current?.getNodes() ?? []
    setCanvasNodes(nodes)
    const ids = canvasRef.current?.getSelectedIds() ?? []
    setCanvasSelectedIds(ids)
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      api.updateTemplate(selectedTemplateId, { canvas_json: json })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 1000)
  }, [selectedTemplateId])

  const handleHtmlChange = useCallback((html: string) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId ? { ...t, html } : t
      )
    )
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      api.updateTemplate(selectedTemplateId, { html })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 1000)
  }, [selectedTemplateId])

  const handleBitmapUpdate = useCallback((bmp: Uint8Array, w: number, h: number) => {
    setBitmap(bmp)
    setBitmapDims({ w, h })
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

  const handleVariablesChange = useCallback((vars: Variable[]) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === selectedTemplateId ? { ...t, variables: vars } : t
      )
    )
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      api.updateTemplate(selectedTemplateId, { variables: vars })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to save'))
    }, 1000)
  }, [selectedTemplateId])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null
  const dims = selectedTemplate
    ? getCanvasDims(selectedTemplate.label_size, labelSettings.orientation)
    : { w: 0, h: 0 }

  const handleLabelSizeChange = useCallback(async (size: LabelSize) => {
    if (!selectedTemplateId) return
    setTemplates((prev) =>
      prev.map((t) => t.id === selectedTemplateId ? { ...t, label_size: size } : t)
    )
    await api.updateTemplate(selectedTemplateId, { label_size: size })
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
    api.updateTemplate(selectedTemplateId, { mode: nextMode })
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
        await api.savePrintJob({
          template_id: selectedTemplate.id,
          variables: printVariables,
          bitmap_png_b64: pngB64,
          printer_name: printerName,
          success: printError === undefined,
          error: printError,
        })
      } catch {
        // History save failure is non-fatal
      }
    }

    setShowPrintDialog(false)
    setPrintSuccess(`Printed ${options.quantity}x on ${printerName}`)
    setTimeout(() => setPrintSuccess(null), 4000)
  }, [bitmap, bitmapDims, selectedTemplate, printerStatus, dims])

  // Intercept 'icon' tool: open modal and revert tool to 'select'
  useEffect(() => {
    if (activeTool === 'icon') {
      setShowIconModal(true)
      setActiveTool('select')
    }
  }, [activeTool])

  const handleIconSelect = useCallback((filename: string) => {
    canvasRef.current?.addImage('/icons/' + filename)
    setShowIconModal(false)
  }, [])

  const hasSelection = selectedObject != null
  const multiSelected = Array.isArray(selectedObject) && selectedObject.length >= 2

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
          loading={loadingTemplates}
        />
        <div className="flex-1" />
        <PrinterPanel
          status={printerStatus}
          connecting={connecting}
          onConnectBLE={handleConnectBLE}
          onConnectSerial={handleConnectSerial}
          onDisconnect={handleDisconnect}
        />
        {selectedTemplate && editorMode === 'canvas' && (
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
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Designer */}
        <div className="flex-1 flex overflow-hidden">
          {!selectedTemplate ? (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <p className="text-sm">Select a template to open the designer</p>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Main editor area */}
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
                  <div className="flex flex-1 overflow-hidden">
                    <ToolSidebar
                      activeTool={activeTool}
                      onToolChange={setActiveTool}
                      hasSelection={hasSelection}
                      onDelete={() => canvasRef.current?.deleteSelected()}
                      onImageUpload={() => canvasRef.current?.triggerImageUpload()}
                    />
                    <LabelCanvas
                      ref={canvasRef}
                      template={selectedTemplate}
                      variableValues={variableValues}
                      activeTool={activeTool}
                      labelSettings={labelSettings}
                      onCanvasChange={handleCanvasChange}
                      onBitmapUpdate={handleBitmapUpdate}
                      onSelectionChange={handleSelectionChange}
                      onToolUsed={() => setActiveTool('select')}
                    />
                  </div>
                ) : (
                  <HtmlEditor
                    html={selectedTemplate.html ?? defaultHtmlForSize(selectedTemplate.label_size)}
                    labelSize={selectedTemplate.label_size}
                    variableValues={variableValues}
                    onChange={handleHtmlChange}
                    onBitmapUpdate={handleBitmapUpdate}
                  />
                )}

                {/* Variable list below editor */}
                <VariableList
                  variables={selectedTemplate.variables}
                  values={variableValues}
                  onChange={handleVariablesChange}
                  onValuesChange={setVariableValues}
                  printRows={printRows}
                  activePrintRow={activePrintRow}
                  onPrintRowsChange={setPrintRows}
                  onActivePrintRowChange={setActivePrintRow}
                />
              </div>

              {/* Right sidebar - bitmap preview + properties */}
              <div className="w-[280px] shrink-0 border-l border-white/10 flex flex-col overflow-hidden bg-[#2a2a2a]">
                <BitmapPreview
                  bitmap={bitmap}
                  width={bitmapDims.w || dims.w}
                  height={bitmapDims.h || dims.h}
                  labelSize={selectedTemplate.label_size}
                  orientation={labelSettings.orientation}
                  printCount={printRows.length > 0 ? printRows.length : 1}
                  activePrintRow={activePrintRow}
                />
                {editorMode === 'canvas' && (
                  <>
                    <div className="flex-1 overflow-y-auto">
                      {multiSelected && (
                        <AlignPanel
                          onAlign={(dir) => canvasRef.current?.alignSelected(dir)}
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
                        onReorder={() => { /* not used */ }}
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
          labelSettings={labelSettings}
          onPrint={handlePrint}
          onClose={() => setShowPrintDialog(false)}
        />
      )}

      {showHistory && (
        <PrintHistory onClose={() => setShowHistory(false)} />
      )}

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
              labelType={labelSettings.labelType}
              density={labelSettings.density}
              cornerStyle={labelSettings.cornerStyle}
              orientation={labelSettings.orientation}
              labelSize={selectedTemplate?.label_size ?? '50x30'}
              onLabelSizeChange={handleLabelSizeChange}
              onChange={(s) => {
                setLabelSettings((prev) => ({ ...prev, ...s }))
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
