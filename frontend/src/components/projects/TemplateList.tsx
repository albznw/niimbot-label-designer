import { useState } from 'react'
import type { Template } from '../../types/project'
import type { LabelSize } from '../../types/label'
import { LABEL_SIZE_LABELS } from '../../types/label'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface TemplateListProps {
  projectName: string
  templates: Template[]
  selectedTemplateId: string | null
  onSelectTemplate: (id: string) => void
  onCreate: (name: string, labelSize: LabelSize, mode: 'canvas' | 'html') => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const MODE_LABELS: Record<'canvas' | 'html', string> = {
  canvas: 'Canvas',
  html: 'HTML',
}

const MODE_COLORS: Record<'canvas' | 'html', string> = {
  canvas: 'bg-purple-600/30 text-purple-300',
  html: 'bg-green-600/30 text-green-300',
}

export function TemplateList({
  projectName,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreate,
  onDelete,
}: TemplateListProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSize, setNewSize] = useState<LabelSize>('50x30')
  const [newMode, setNewMode] = useState<'canvas' | 'html'>('canvas')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreate(newName.trim(), newSize, newMode)
      setNewName('')
      setNewSize('50x30')
      setNewMode('canvas')
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setConfirmDeleteId(null)
  }

  const confirmTarget = templates.find((t) => t.id === confirmDeleteId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h2 className="text-base font-semibold">{projectName}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          + New Template
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {templates.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <p className="text-sm">No templates yet.</p>
            <p className="text-xs mt-1">Create one to get started.</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2">
          {templates.map((template) => (
            <TemplateRow
              key={template.id}
              template={template}
              selected={template.id === selectedTemplateId}
              onSelect={() => onSelectTemplate(template.id)}
              onDelete={() => setConfirmDeleteId(template.id)}
            />
          ))}
        </div>
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
              <label className="text-sm text-gray-300">Label size</label>
              <div className="flex gap-2">
                {(['50x30', '30x50', '30x30'] as LabelSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setNewSize(size)}
                    className={`flex-1 py-1.5 rounded text-sm border transition-colors ${
                      newSize === size
                        ? 'border-accent bg-accent/20 text-white'
                        : 'border-white/20 text-gray-400 hover:border-white/40'
                    }`}
                  >
                    {LABEL_SIZE_LABELS[size]}
                  </button>
                ))}
              </div>
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
    </div>
  )
}

function TemplateRow({
  template,
  selected,
  onSelect,
  onDelete,
}: {
  template: Template
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`group flex items-center justify-between px-4 py-3 rounded cursor-pointer transition-colors border ${
        selected
          ? 'bg-accent/20 border-accent/40 text-white'
          : 'bg-[#2a2a2a] border-white/5 hover:border-white/20 text-gray-300'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium truncate">{template.name}</span>
        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${MODE_COLORS[template.mode]}`}>
          {MODE_LABELS[template.mode]}
        </span>
        <span className="shrink-0 text-xs text-gray-500">{LABEL_SIZE_LABELS[template.label_size]}</span>
      </div>
      <button
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-lg leading-none ml-2 shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete template"
      >
        ×
      </button>
    </div>
  )
}
