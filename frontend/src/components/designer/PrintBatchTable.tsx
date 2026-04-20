import { useState, useEffect } from 'react'

interface PrintBatchTableProps {
  variables: { name: string }[]
  rows: Record<string, string>[]
  activeRow: number
  onRowsChange: (rows: Record<string, string>[]) => void
  onActiveRowChange: (index: number) => void
}

function rowsToCsv(variables: { name: string }[], rows: Record<string, string>[]): string {
  const header = variables.map((v) => v.name).join('\t')
  if (rows.length === 0) return header
  const data = rows.map((row) => variables.map((v) => row[v.name] ?? '').join('\t'))
  return [header, ...data].join('\n')
}

function parseCsv(
  text: string,
  varNames: string[]
): Record<string, string>[] {
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
  if (lines.length < 2) return []
  const sep = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(sep).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(sep)
    const row: Record<string, string> = {}
    varNames.forEach((name) => { row[name] = '' })
    headers.forEach((h, i) => {
      if (varNames.includes(h)) row[h] = cells[i]?.trim() ?? ''
    })
    return row
  })
}

export function PrintBatchTable({
  variables,
  rows,
  activeRow,
  onRowsChange,
  onActiveRowChange,
}: PrintBatchTableProps) {
  const [csvText, setCsvText] = useState(() => rowsToCsv(variables, rows))

  // Sync text when variables change (header row changes)
  useEffect(() => {
    setCsvText(rowsToCsv(variables, rows))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variables.map((v) => v.name).join(',')])

  const handleChange = (text: string) => {
    setCsvText(text)
    const varNames = variables.map((v) => v.name)
    const parsed = parseCsv(text, varNames)
    onRowsChange(parsed)
    if (activeRow >= parsed.length && parsed.length > 0) onActiveRowChange(0)
  }

  const placeholder =
    variables.map((v) => v.name).join('\t') +
    '\n' +
    variables.map((v) => `${v.name}1`).join('\t')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-500">
        Paste CSV or TSV — first row must be variable names as headers
      </p>
      <textarea
        className="font-mono text-xs bg-[#111] border border-white/10 rounded px-2 py-1.5 text-white resize-y focus:outline-none focus:border-accent"
        rows={6}
        value={csvText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
      />
      {rows.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-600">·</span>
          <span>Preview:</span>
          <button
            disabled={activeRow === 0}
            onClick={() => onActiveRowChange(activeRow - 1)}
            className="px-1.5 py-0.5 rounded border border-white/10 bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ‹
          </button>
          <span className="text-white">{activeRow + 1}</span>
          <button
            disabled={activeRow >= rows.length - 1}
            onClick={() => onActiveRowChange(activeRow + 1)}
            className="px-1.5 py-0.5 rounded border border-white/10 bg-[#1a1a1a] hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
