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

// CSV format (RFC 4180):
//   line 0 = variable names
//   lines 1+ = data rows (all are print rows; line 1 drives canvas preview by default)

function quoteField(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function serialize(variables: Variable[], printRows: Record<string, string>[]): string {
  const header = variables.map((v) => quoteField(v.name)).join(',')
  const rows = printRows.map((row) => variables.map((v) => quoteField(row[v.name] ?? '')).join(','))
  return [header, ...rows].join('\n')
}

function parseFields(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i <= line.length) {
    if (line[i] === '"') {
      // Quoted field
      i++ // skip opening quote
      let field = ''
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"'
            i += 2
          } else {
            i++ // skip closing quote
            break
          }
        } else {
          field += line[i]
          i++
        }
      }
      fields.push(field)
      if (line[i] === ',') i++ // skip delimiter
    } else {
      // Unquoted field - read until next comma or end
      const end = line.indexOf(',', i)
      if (end === -1) {
        fields.push(line.slice(i))
        break
      } else {
        fields.push(line.slice(i, end))
        i = end + 1
      }
    }
  }
  return fields
}

function migrateTsvToCsv(text: string): string {
  const firstLine = text.split('\n')[0] ?? ''
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    return text.replace(/\t/g, ',')
  }
  return text
}

function parseCSV(text: string): {
  variables: Variable[]
  values: Record<string, string>
  printRows: Record<string, string>[]
} {
  const lines = text.split('\n')
  const [headerLine = '', ...rowLines] = lines
  const varNames = parseFields(headerLine).map((s) => s.trim()).filter(Boolean)
  const variables: Variable[] = varNames.map((name) => ({ name, type: 'text' as const, default: '' }))
  const printRows = rowLines
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = parseFields(line)
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

  // Keep handler refs current so the mount effect never captures stale closures
  const onChangeRef = useRef(onChange)
  const onValuesChangeRef = useRef(onValuesChange)
  const onTextChangeRef = useRef(onTextChange)
  const onPrintRowsChangeRef = useRef(onPrintRowsChange)
  const onActivePrintRowChangeRef = useRef(onActivePrintRowChange)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onValuesChangeRef.current = onValuesChange }, [onValuesChange])
  useEffect(() => { onTextChangeRef.current = onTextChange }, [onTextChange])
  useEffect(() => { onPrintRowsChangeRef.current = onPrintRowsChange }, [onPrintRowsChange])
  useEffect(() => { onActivePrintRowChangeRef.current = onActivePrintRowChange }, [onActivePrintRowChange])

  // Mount Monaco once
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false

    import('monaco-editor').then((monaco) => {
      if (disposed || !containerRef.current) return

      const initial = migrateTsvToCsv(initialText || serialize(variables, printRows))

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
      onChangeRef.current(parsed.variables)
      onValuesChangeRef.current(parsed.values)
      onPrintRowsChangeRef.current(parsed.printRows)

      editor.onDidChangeModelContent(() => {
        if (suppressRef.current) return
        const text = editor.getValue()
        onTextChangeRef.current(text)
        const parsed = parseCSV(text)
        onChangeRef.current(parsed.variables)
        onValuesChangeRef.current(parsed.values)
        onPrintRowsChangeRef.current(parsed.printRows)
      })

      editor.onDidChangeCursorPosition((e) => {
        // line 1 = header, lines 2+ = data rows (0-indexed)
        const line = e.position.lineNumber
        onActivePrintRowChangeRef.current(Math.max(0, line - 2))
      })
    })

    return () => {
      disposed = true
      editorRef.current?.dispose()
      editorRef.current = null
    }
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
