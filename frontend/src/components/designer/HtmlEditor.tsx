import { useEffect, useRef, useState } from 'react'
import type * as MonacoType from 'monaco-editor'
import type { LabelSize } from '../../types/label'
import { htmlTo1BitBitmap } from '../../lib/html-renderer'
import { LABEL_DIMS } from '../../types/label'

interface HtmlEditorProps {
  html: string
  labelSize: LabelSize
  variableValues: Record<string, string>
  onChange: (html: string) => void
  onBitmapUpdate: (bitmap: Uint8Array, w: number, h: number) => void
}

export function HtmlEditor({
  html,
  labelSize,
  variableValues,
  onChange,
  onBitmapUpdate,
}: HtmlEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MonacoType.editor.IStandaloneCodeEditor | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [rendering, setRendering] = useState(false)

  const triggerRender = (value: string, vars: Record<string, string>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { w, h } = LABEL_DIMS[labelSize]
      setRendering(true)
      try {
        const result = await htmlTo1BitBitmap(value, w, h, vars)
        onBitmapUpdate(result.bitmap, result.width, result.height)
      } catch (e) {
        console.error('html render error', e)
      } finally {
        setRendering(false)
      }
    }, 600)
  }

  // Mount Monaco
  useEffect(() => {
    if (!containerRef.current) return

    let disposed = false

    import('monaco-editor').then((monaco) => {
      if (disposed || !containerRef.current) return

      const editor = monaco.editor.create(containerRef.current, {
        value: html,
        language: 'html',
        theme: 'vs-dark',
        wordWrap: 'on',
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
      })

      editorRef.current = editor

      editor.onDidChangeModelContent(() => {
        const value = editor.getValue()
        onChange(value)
        triggerRender(value, variableValues)
      })

      // Initial render
      triggerRender(html, variableValues)
    })

    return () => {
      disposed = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      editorRef.current?.dispose()
      editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render when variableValues change
  useEffect(() => {
    const value = editorRef.current?.getValue() ?? html
    triggerRender(value, variableValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableValues])

  // Sync external html prop into editor if it differs (e.g. template switch)
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.getValue() !== html) {
      editor.setValue(html)
    }
  }, [html])

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {rendering && (
        <div className="absolute top-2 right-3 z-10 text-xs text-gray-400 bg-[#1e1e1e]/80 px-2 py-0.5 rounded pointer-events-none">
          Rendering...
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-hidden" />
    </div>
  )
}
