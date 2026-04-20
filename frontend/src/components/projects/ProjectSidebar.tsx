import { useState } from 'react'
import type { Project } from '../../types/project'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'

interface ProjectSidebarProps {
  projects: Project[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ProjectSidebar({
  projects,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
}: ProjectSidebarProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await onCreate(newName.trim())
      setNewName('')
      setShowCreate(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await onDelete(id)
    setConfirmDeleteId(null)
  }

  const confirmTarget = projects.find((p) => p.id === confirmDeleteId)

  return (
    <aside className="w-[250px] shrink-0 bg-[#2a2a2a] flex flex-col border-r border-white/10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Projects
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)} title="New project">
          +
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {projects.length === 0 && (
          <p className="px-4 py-3 text-sm text-gray-500">No projects yet.</p>
        )}
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            selected={project.id === selectedId}
            onSelect={() => onSelect(project.id)}
            onDelete={() => setConfirmDeleteId(project.id)}
          />
        ))}
      </nav>

      {showCreate && (
        <Modal title="New Project" onClose={() => { setShowCreate(false); setNewName('') }}>
          <div className="flex flex-col gap-4">
            <Input
              id="project-name"
              label="Project name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              autoFocus
              placeholder="My Label Project"
            />
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
        <Modal title="Delete Project" onClose={() => setConfirmDeleteId(null)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-300">
              Delete <span className="text-white font-semibold">{confirmTarget.name}</span> and all its templates? This cannot be undone.
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
    </aside>
  )
}

function ProjectRow({
  project,
  selected,
  onSelect,
  onDelete,
}: {
  project: Project
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`group flex items-center justify-between px-4 py-2 cursor-pointer transition-colors ${
        selected ? 'bg-accent/20 text-white' : 'hover:bg-white/5 text-gray-300'
      }`}
      onClick={onSelect}
    >
      <span className="text-sm truncate">{project.name}</span>
      <button
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-lg leading-none ml-2 shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        title="Delete project"
      >
        ×
      </button>
    </div>
  )
}
