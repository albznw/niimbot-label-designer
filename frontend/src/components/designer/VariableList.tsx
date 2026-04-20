import { useEffect, useRef } from 'react'
import type * as MonacoType from 'monaco-editor'
import type { Variable } from '../../types/project'

interface VariableListProps {
  variables: Variable[]
  values: Record<string, string>
  onChange: (vars: Variable[]) => void
  onValuesChange: (values: Record<string, string>) => void
  onTextChange: (text: string) => void
  printRows: Record<string, string>[]
  activePrintRow: number
  onPrintRowsChange: (rows: Record<string, string>[]) => void
  onActivePrintRowChange: (index: number) => void
  initialText: string
  syncKey: string
}

// CSV format:
//   line 0 = variable names
//   lines 1+ = data rows (all are print rows; line 1 drives canvas preview by default)

function serialize(variables: Variable[], printRows: Record<string, string>[]): string {
  const header = variables.map((v) => v.name).join(',')
  const rows = printRows.map((row) => variables.map((v) => row[v.name] ?? '').join(','))
  return [header, ...rows].join('\n')
}

function parseCSV(text: string): {
  variables: Variable[]
  values: Record<string, string>
  printRows: Record<string, string>[]
} {
  const lines = text.split('\n')
  const [headerLine = '', ...rowLines] = lines
  const varNames = headerLine.split(',').map((s) => s.trim()).filter(Boolean)
  const variables: Variable[] = varNames.map((name) => ({ name, type: 'text' as const, default: '' }))
  const printRows = rowLines
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split(',')
      return Object.fromEntries(varNames.map((n, i) => [n, parts[i] ?? '']))
    })
  const firstRow = printRows[0] ?? {}
  const values = Object.fromEntries(varNames.map((n) => [n, firstRow[n] ?? '']))
  return { variables, values, printRows }
}

export function VariableList({
  variables,
  values,
  onChange,
  onValuesChange,
  onTextChange,
  printRows,
  onPrintRowsChange,
  onActivePrintRowChange,
  initialText,
  syncKey,
}: VariableListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)
  const suppressRef = useRef(false)
  const dataRef = useRef({ variables, values, printRows })

  // Mount Monaco once
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    import('monaco-editor').then((monaco) => {
      if (disposed || !containerRef.current) return

      const initial = initialText || serialize(variables, printRows)

      const editor = monaco.editor.create(containerRef.current!, {
        value: initial,
        language: 'plaintext',
        theme: 'vs-dark',
        minimap: { enabled: false },
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        renderLineHighlight: 'none',
        scrollBeyondLastLine: false,
        wordWrap: 'off',
        fontSize: 12,
        fontFamily: 'var(--vscode-editor-font-family, "Cascadia Code", Menlo, monospace)',
        automaticLayout: true,
        scrollbar: { vertical: 'hidden', horizontal: 'auto', alwaysConsumeMouseWheel: false },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        padding: { top: 4, bottom: 4 },
      })

      editorRef.current = editor

      const parsed = parseCSV(initial)
      onChange(parsed.variables)
      onValuesChange(parsed.values)
      onPrintRowsChange(parsed.printRows)

      editor.onDidChangeModelContent(() => {
        if (suppressRef.current) return
        const text = editor.getValue()
        onTextChange(text)
        const parsed = parseCSV(text)
        onChange(parsed.variables)
        onValuesChange(parsed.values)
        onPrintRowsChange(parsed.printRows)
      })

      editor.onDidChangeCursorPosition((e) => {
        // line 1 = header, lines 2+ = data rows (0-indexed)
        const line = e.position.lineNumber
        onActivePrintRowChange(Math.max(0, line - 2))
      })
    })

    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep latest data in a ref so syncKey effect can read it without stale closure
  useEffect(() => {
    dataRef.current = { variables, values, printRows }
  }, [variables, values, printRows])

  // Only reset editor on template switch (syncKey change), not on every user edit
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const { variables, printRows } = dataRef.current
    suppressRef.current = true
    editor.setValue(serialize(variables, printRows))
    suppressRef.current = false
  }, [syncKey])

  return (
    <div className="shrink-0" style={{ height: 110 }}>
      <div ref={containerRef} style={{ height: '100%' }} />
    </div>
  )
}
