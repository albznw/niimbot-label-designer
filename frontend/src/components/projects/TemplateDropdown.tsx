import { useState, useEffect, useRef } from 'react'
import type { Template } from '../../types/project'
import { LABEL_PROFILES, DEFAULT_PROFILE_ID } from '../../types/label'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface TemplateDropdownProps {
  templates: Template[]
  selectedTemplateId: string | null
  onSelectTemplate: (id: string) => void
  onCreate: (name: string, profileId: string, mode: 'canvas' | 'html') => Promise<void>
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
  onImport: (data: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  loading: boolean
}

const MODE_LABELS: Record<'canvas' | 'html', string> = {
  canvas: 'Canvas',
  html: 'HTML',
}

const MODE_COLORS: Record<'canvas' | 'html', string> = {
  canvas: 'bg-purple-600/30 text-purple-300',
  html: 'bg-green-600/30 text-green-300',
}

export function TemplateDropdown({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreate,
  onDelete,
  onRename,
  onImport,
  loading,
}: TemplateDropdownProps) {
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newProfileId, setNewProfileId] = useState<string>(DEFAULT_PROFILE_ID)
  const [newMode, setNewMode] = useState<'canvas' | 'html'>('canvas')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreate(newName.trim(), newProfileId, newMode)
      setNewName('')
      setNewProfileId(DEFAULT_PROFILE_ID)
      setNewMode('canvas')
      setShowCreate(false)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setConfirmDeleteId(null)
  }

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) return
    await onRename(renamingId, renameValue.trim())
    setRenamingId(null)
    setRenameValue('')
  }

  const handleExport = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation()
    const json = JSON.stringify(template, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (fileInputRef.current) fileInputRef.current.value = ''

    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>).name !== 'string' ||
        ((parsed as Record<string, unknown>).mode !== 'canvas' && (parsed as Record<string, unknown>).mode !== 'html') ||
        typeof (parsed as Record<string, unknown>).label_profile !== 'string' ||
        !('canvas_json' in parsed) ||
        !('html' in parsed) ||
        !Array.isArray((parsed as Record<string, unknown>).variables) ||
        !Array.isArray((parsed as Record<string, unknown>).print_rows) ||
        !('variable_text' in parsed)
      ) {
        console.error('Invalid template file: missing required fields')
        return
      }

      const raw = parsed as Record<string, unknown>
      const data: Omit<Template, 'id' | 'created_at' | 'updated_at'> = {
        name: raw.name as string,
        mode: raw.mode as 'canvas' | 'html',
        label_profile: raw.label_profile as string,
        display_orientation: (raw.display_orientation as Template['display_orientation']) ?? 'landscape',
        density: typeof raw.density === 'number' ? raw.density : 3,
        canvas_json: raw.canvas_json as string | null,
        html: raw.html as string | null,
        variables: raw.variables as Template['variables'],
        print_rows: raw.print_rows as Record<string, string>[],
        variable_text: raw.variable_text as string | null,
        corner_style: (raw.corner_style as Template['corner_style']) ?? 'rect',
      }

      await onImport(data)
      setOpen(false)
    } catch (err) {
      console.error('Failed to import template:', err)
    }
  }

  const profileById = (id: string) => LABEL_PROFILES.find((p) => p.id === id)

  const confirmTarget = templates.find((t) => t.id === confirmDeleteId)
  const renameTarget = templates.find((t) => t.id === renamingId)

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        name="import-file"
        accept=".json"
        className="hidden"
        onChange={(e) => void handleImportFile(e)}
      />

      <div ref={containerRef} className="relative flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs px-3 py-1.5 bg-[#333] hover:bg-[#444] rounded transition-colors border border-white/10 max-w-[320px]"
        >
          <span className="truncate">
            {loading ? 'Loading...' : (selectedTemplate?.name ?? 'Select template')}
          </span>
          <span className="shrink-0 text-gray-400">▾</span>
        </button>
        {selectedTemplate && (
          <button
            className={"text-xs font-mono transition-colors select-all " + (copied ? 'text-green-400' : 'text-gray-500 hover:text-gray-300')}
            title="Click to copy ID"
            onClick={() => {
              navigator.clipboard.writeText(selectedTemplate.id).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }).catch(() => {})
            }}
          >
            {copied ? 'copied!' : selectedTemplate.id}
          </button>
        )}

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[320px] bg-[#2a2a2a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
            {loading ? (
              <div className="px-4 py-3 text-xs text-gray-400">Loading...</div>
            ) : (
              <>
                <div className="max-h-72 overflow-y-auto">
                  {templates.length === 0 ? (
                    <div className="px-4 py-4 text-xs text-gray-500 text-center">
                      No templates yet.
                    </div>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className={`group flex items-center justify-between px-3 py-2 cursor-pointer transition-colors border-b border-white/5 last:border-b-0 ${
                          template.id === selectedTemplateId
                            ? 'bg-accent/20 text-white'
                            : 'hover:bg-white/5 text-gray-300'
                        }`}
                        onClick={() => {
                          onSelectTemplate(template.id)
                          setOpen(false)
                        }}
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{template.name}</span>
                            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${MODE_COLORS[template.mode]}`}>
                              {MODE_LABELS[template.mode]}
                            </span>
                            <span className="shrink-0 text-xs text-gray-500">
                              {profileById(template.label_profile)?.name ?? template.label_profile}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-gray-600">{template.id}</span>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-2 shrink-0 transition-all">
                          <button
                            className="text-gray-500 hover:text-green-400 transition-colors text-xs px-1"
                            onClick={(e) => handleExport(template, e)}
                            title="Export template"
                          >
                            ↓
                          </button>
                          <button
                            className="text-gray-500 hover:text-blue-400 transition-colors text-xs px-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRenamingId(template.id)
                              setRenameValue(template.name)
                              setOpen(false)
                            }}
                            title="Rename template"
                          >
                            ✎
                          </button>
                          <button
                            className="text-gray-500 hover:text-red-400 transition-colors text-lg leading-none"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDeleteId(template.id)
                              setOpen(false)
                            }}
                            title="Delete template"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-white/10">
                  <button
                    onClick={() => {
                      setShowCreate(true)
                      setOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    + New Template
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5"
                  >
                    ↑ Import Template
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal title="New Template" onClose={() => { setShowCreate(false); setNewName('') }}>
          <div className="flex flex-col gap-4">
            <Input
              id="template-name"
              label="Template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              autoFocus
              placeholder="Part Label"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-300">Label profile</label>
              <select
                value={newProfileId}
                onChange={(e) => setNewProfileId(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
              >
                {LABEL_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-300">Mode</label>
              <div className="flex gap-2">
                {(['canvas', 'html'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setNewMode(mode)}
                    className={`flex-1 py-1.5 rounded text-sm border transition-colors ${
                      newMode === mode
                        ? 'border-accent bg-accent/20 text-white'
                        : 'border-white/20 text-gray-400 hover:border-white/40'
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowCreate(false); setNewName('') }}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={saving || !newName.trim()}>
                {saving ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {confirmTarget && (
        <Modal title="Delete Template" onClose={() => setConfirmDeleteId(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-300">
              Delete <span className="text-white font-semibold">{confirmTarget.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => handleDelete(confirmTarget.id)}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {renameTarget && (
        <Modal title="Rename Template" onClose={() => { setRenamingId(null); setRenameValue('') }}>
          <div className="flex flex-col gap-4">
            <Input
              id="rename-template"
              label="Template name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleRename() }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setRenamingId(null); setRenameValue('') }}>
                Cancel
              </Button>
              <Button onClick={() => void handleRename()} disabled={!renameValue.trim()}>
                Rename
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
