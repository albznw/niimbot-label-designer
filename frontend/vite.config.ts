import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  plugins: [
    react(),
    (monacoEditorPlugin as any).default({ languages: ['html', 'css', 'javascript', 'typescript'] }),
  ],
  server: {
    proxy: { '/api': 'http://localhost:8000' }
  },
  optimizeDeps: {
    include: ['html2canvas'],
  },
})
