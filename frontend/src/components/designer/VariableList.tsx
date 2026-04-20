import { useState } from 'react'
import type { Variable } from '../../types/project'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'

interface VariableListProps {
  variables: Variable[]
  values: Record<string, string>
  onChange: (vars: Variable[]) => void
  onValuesChange: (values: Record<string, string>) => void
}

const TYPE_COLORS: Record<Variable['type'], string> = {
  text: 'bg-blue-600/30 text-blue-300',
  number: 'bg-yellow-600/30 text-yellow-300',
  url: 'bg-green-600/30 text-green-300',
}

export function VariableList({ variables, values, onChange, onValuesChange }: VariableListProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Variable | null>(null)

  const [form, setForm] = useState<Variable>({ name: '', type: 'text', default: '' })

  const openAdd = () => {
    setForm({ name: '', type: 'text', default: '' })
    setEditTarget(null)
    setShowAdd(true)
  }

  const openEdit = (v: Variable) => {
    setForm({ ...v })
    setEditTarget(v)
    setShowAdd(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) return
    if (editTarget) {
      onChange(variables.map((v) => (v.name === editTarget.name ? form : v)))
      // update value key if name changed
      if (editTarget.name !== form.name) {
        const next = { ...values }
        next[form.name] = next[editTarget.name] ?? form.default
        delete next[editTarget.name]
        onValuesChange(next)
      }
    } else {
      onChange([...variables, form])
      onValuesChange({ ...values, [form.name]: form.default })
    }
    setShowAdd(false)
  }

  const handleDelete = (name: string) => {
    onChange(variables.filter((v) => v.name !== name))
    const next = { ...values }
    delete next[name]
    onValuesChange(next)
  }

  return (
    <div className="border-t border-white/10 bg-[#2a2a2a] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
          onClick={() => setCollapsed((c) => !c)}
        >
          <span>{collapsed ? '▶' : '▼'}</span>
          Variables
          <span className="normal-case font-normal text-gray-600">({variables.length})</span>
        </button>
        <Button variant="ghost" size="sm" onClick={openAdd}>+ Add</Button>
      </div>

      {!collapsed && (
        <div className="px-4 pb-3 flex flex-col gap-3">
          {/* Variable definitions */}
          {variables.length === 0 ? (
            <p className="text-xs text-gray-600">No variables defined. Add one to use &#123;&#123;varName&#125;&#125; in text.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {variables.map((v) => (
                <div
                  key={v.name}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#1a1a1a] border border-white/5"
                >
                  <span className="text-xs font-mono text-white">{`{{${v.name}}}`}</span>
                  <span className={`text-xs px-1 rounded ${TYPE_COLORS[v.type]}`}>{v.type}</span>
                  {v.default && (
                    <span className="text-xs text-gray-500 truncate max-w-[80px]" title={v.default}>
                      = {v.default}
                    </span>
                  )}
                  <div className="ml-auto flex gap-1">
                    <button
                      className="text-xs text-gray-500 hover:text-white transition-colors px-1"
                      onClick={() => openEdit(v)}
                    >
                      ✎
                    </button>
                    <button
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors px-1"
                      onClick={() => handleDelete(v.name)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Preview values */}
          {variables.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Preview values</p>
              <div className="grid grid-cols-2 gap-2">
                {variables.map((v) => (
                  <label key={v.name} className="flex flex-col gap-0.5">
                    <span className="text-xs text-gray-500 font-mono">{v.name}</span>
                    <input
                      type={v.type === 'number' ? 'number' : 'text'}
                      className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
                      value={values[v.name] ?? v.default}
                      onChange={(e) => onValuesChange({ ...values, [v.name]: e.target.value })}
                      placeholder={v.default || v.name}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <Modal
          title={editTarget ? 'Edit Variable' : 'Add Variable'}
          onClose={() => setShowAdd(false)}
        >
          <div className="flex flex-col gap-4">
            <Input
              id="var-name"
              label="Name (no spaces)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.replace(/\s/g, '_') }))}
              placeholder="myVariable"
              autoFocus
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-300">Type</label>
              <div className="flex gap-2">
                {(['text', 'number', 'url'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex-1 py-1.5 rounded text-sm border transition-colors ${
                      form.type === t
                        ? 'border-accent bg-accent/20 text-white'
                        : 'border-white/20 text-gray-400 hover:border-white/40'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Input
              id="var-default"
              label="Default value"
              value={form.default}
              onChange={(e) => setForm((f) => ({ ...f, default: e.target.value }))}
              placeholder="default..."
            />

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={!form.name.trim()}>
                {editTarget ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
