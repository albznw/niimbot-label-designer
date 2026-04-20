import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#1a1a1a',
        panel: '#2a2a2a',
        accent: '#3b82f6',
      }
    }
  },
  plugins: []
} satisfies Config
