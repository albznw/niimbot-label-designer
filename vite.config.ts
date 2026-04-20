import { defineConfig } from 'vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  plugins: [
    (monacoEditorPlugin as any).default({ languages: ['html', 'css', 'javascript'] })
  ],
  optimizeDeps: {
    include: ['@mmote/niimbluelib', 'html2canvas'],
  },
})
